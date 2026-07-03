/* --- Winning-Grade Civic Portal JS Core Logic Engine --- */

// Globally managed variables
let categoryChartInstance = null;
let lastDeletedComplaint = null; // Undo Stack Slot
let undoTimeoutId = null;

// Simulated city locations coordinates mapper
const locationCoordMap = {
    "West Sector": { x: 25, y: 35 },
    "North Zone": { x: 50, y: 15 },
    "Central Avenue": { x: 50, y: 50 },
    "South Gate": { x: 45, y: 80 },
    "East Ward": { x: 75, y: 45 },
    "industrial park": { x: 80, y: 75 },
    "subway crossing": { x: 30, y: 70 },
    "market square": { x: 55, y: 35 }
};

// 1. Service Worker registration for PWA features
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js")
            .then(reg => console.log("PWA Service Worker registered successfully.", reg.scope))
            .catch(err => console.warn("Service worker registration failed: ", err));
    });
}

// Helper: Toast Notifications
const showToast = (message, type = "success") => {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    const icon = type === "success" ? "fa-check-circle" : "fa-exclamation-circle";
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.5s forwards";
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 2500);
};

// Helper: Loading Indicator
const showLoading = (message = "Processing telemetry...") => {
    document.getElementById("loading-message").textContent = message;
    document.getElementById("loading-overlay").style.display = "flex";
};

const hideLoading = () => {
    document.getElementById("loading-overlay").style.display = "none";
};

// LocalStorage helpers
const getComplaints = () => {
    try {
        const data = localStorage.getItem("civic_complaints");
        if (!data) return getMockComplaints();
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : getMockComplaints();
    } catch (e) {
        console.error("LocalStorage corrupted. Resetting data.", e);
        return getMockComplaints();
    }
};

const saveComplaints = (complaints) => {
    localStorage.setItem("civic_complaints", JSON.stringify(complaints));
};

// Provide premium initial mock data so the dashboard doesn't look empty initially
function getMockComplaints() {
    const mock = [
        {
            id: "mp928k1a",
            name: "Emily Watson",
            email: "emily@example.com",
            category: "Water Leakage",
            location: "Central Avenue",
            description: "A huge water pipe burst is causing massive flooding and clogging traffic near Central Avenue.",
            priority: "High",
            department: "Water & Sewage Department",
            resolutionTime: "12 Hours",
            status: "Pending",
            timestamp: new Date(Date.now() - 3600000 * 4).toISOString() // 4 hrs ago
        },
        {
            id: "kp837s2c",
            name: "Rajesh Kumar",
            email: "rajesh@example.com",
            category: "Street Light",
            location: "North Zone",
            description: "All street lights are broken in Sector 4. The area is completely dark and unsafe at night.",
            priority: "High",
            department: "Electrical Department",
            resolutionTime: "24 Hours",
            status: "Pending",
            timestamp: new Date(Date.now() - 3600000 * 24).toISOString() // 1 day ago
        },
        {
            id: "rp734t1m",
            name: "Marcus Vance",
            email: "marcus@example.com",
            category: "Road Damage",
            location: "West Sector",
            description: "Deep pothole causing motorbikes to lose balance near the main highway entrance.",
            priority: "Medium",
            department: "Public Works",
            resolutionTime: "3-5 Days",
            status: "Resolved",
            timestamp: new Date(Date.now() - 3600000 * 72).toISOString() // 3 days ago
        }
    ];
    localStorage.setItem("civic_complaints", JSON.stringify(mock));
    return mock;
}

// Simulated AI Decision Matrix with context-aware keyword matching
const assignComplaintDetails = (category, description = "") => {
    let priority = "Low";
    let department = "General Department";
    let resolutionTime = "5-7 Days";

    const descLower = description.toLowerCase();

    switch (category) {
        case "Garbage":
            department = "Sanitation Department";
            if (descLower.includes("overflowing") || descLower.includes("stinking") || descLower.includes("toxic") || descLower.includes("hospital")) {
                priority = "High";
                resolutionTime = "12-24 Hours";
            } else if (descLower.includes("plastic") || descLower.includes("pile") || descLower.includes("recycling")) {
                priority = "Medium";
                resolutionTime = "1-2 Days";
            } else {
                priority = "Low";
                resolutionTime = "2 Days";
            }
            break;
        case "Road Damage":
            department = "Public Works";
            if (descLower.includes("pothole") && (descLower.includes("accident") || descLower.includes("injury") || descLower.includes("highway") || descLower.includes("main road"))) {
                priority = "High";
                resolutionTime = "24-48 Hours";
            } else if (descLower.includes("crack") || descLower.includes("speed breaker")) {
                priority = "Low";
                resolutionTime = "5-7 Days";
            } else {
                priority = "Medium";
                resolutionTime = "3-5 Days";
            }
            break;
        case "Water Leakage":
            department = "Water & Sewage Department";
            if (descLower.includes("flooding") || descLower.includes("burst") || descLower.includes("gushing")) {
                priority = "High";
                resolutionTime = "12 Hours";
            } else if (descLower.includes("drinking water") || descLower.includes("contamination")) {
                priority = "High";
                resolutionTime = "24 Hours";
            } else {
                priority = "Medium";
                resolutionTime = "2 Days";
            }
            break;
        case "Street Light":
            department = "Electrical Department";
            if (descLower.includes("dark") && (descLower.includes("unsafe") || descLower.includes("crime") || descLower.includes("theft") || descLower.includes("blackout"))) {
                priority = "High";
                resolutionTime = "24 Hours";
            } else if (descLower.includes("flickering")) {
                priority = "Low";
                resolutionTime = "3 Days";
            } else {
                priority = "Medium";
                resolutionTime = "2-3 Days";
            }
            break;
        case "Other":
            department = "Municipal Administrative Wing";
            if (descLower.includes("emergency") || descLower.includes("fire") || descLower.includes("danger")) {
                priority = "High";
                resolutionTime = "12-24 Hours";
            } else {
                priority = "Low";
                resolutionTime = "5-7 Days";
            }
            break;
    }
    return { priority, department, resolutionTime };
};

// Render Individual Card Component with interactive Smart Timeline & Speech API support
const renderComplaintCard = (complaint) => {
    const card = document.createElement("div");
    card.classList.add("complaint-card");
    card.dataset.id = complaint.id;

    let categoryIcon = "fa-exclamation-triangle";
    if (complaint.category === "Garbage") categoryIcon = "fa-trash-alt";
    else if (complaint.category === "Road Damage") categoryIcon = "fa-road";
    else if (complaint.category === "Water Leakage") categoryIcon = "fa-tint";
    else if (complaint.category === "Street Light") categoryIcon = "fa-lightbulb";

    // Progress timeline simulation
    const steps = ["Registered", "Assigned", "In Progress", "Resolved"];
    let currentStepIndex = 1; // Default mapped
    if (complaint.priority === "High") currentStepIndex = 2; // Immediate progress
    if (complaint.status === "Resolved") currentStepIndex = 3;

    const timelineHTML = `
        <div class="timeline-wrapper">
            ${steps.map((step, idx) => `
                <div class="timeline-step ${idx <= currentStepIndex ? 'active' : ''}">
                    <div class="timeline-dot"></div>
                    <span class="timeline-label">${step}</span>
                </div>
            `).join('')}
        </div>
    `;

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <h3 style="font-size: 1.15em;"><i class="fas ${categoryIcon}" style="color: var(--primary-color); margin-right: 8px;"></i>Complaint #${complaint.id.substring(0, 8).toUpperCase()}</h3>
            <span class="status-${complaint.status.toLowerCase()}" style="font-size: 0.85em; padding: 4px 10px; border-radius: 20px; background: var(--input-background); border: 1px solid var(--border-color); font-weight:600;"><i class="fas ${complaint.status === 'Resolved' ? 'fa-check-circle' : 'fa-hourglass-half'}"></i> ${complaint.status}</span>
        </div>
        
        <p><strong><i class="fas fa-user-shield" style="width: 20px; color: var(--primary-color);"></i> Citizen:</strong> ${complaint.name}</p>
        <p><strong><i class="fas fa-map-marked-alt" style="width: 20px; color: var(--primary-color);"></i> Area Zone:</strong> ${complaint.location}</p>
        
        <div style="margin: 12px 0; padding: 10px 14px; background: rgba(0,0,0,0.03); border-radius: 8px; border-left: 4px solid var(--primary-color); font-size:0.9em;">
            <p style="font-style: italic;">"${complaint.description}"</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85em; margin-bottom: 10px;">
            <p><strong>Priority:</strong> <span class="priority-${complaint.priority.toLowerCase()}" style="font-weight: 700;"><i class="fas fa-flag"></i> ${complaint.priority}</span></p>
            <p><strong>Est. Time:</strong> <i class="fas fa-calendar-alt"></i> ${complaint.resolutionTime}</p>
        </div>
        <p style="font-size: 0.85em; margin-bottom: 15px;"><strong>Routing Dept:</strong> <i class="fas fa-building-ngo"></i> ${complaint.department}</p>
        
        ${timelineHTML}

        <div class="card-actions" style="margin-top: 15px;">
            <button class="btn btn-outline btn-speak tooltip" data-id="${complaint.id}" data-tooltip="Audibly Read Description" style="padding: 6px 12px; font-size:0.85em;"><i class="fas fa-volume-up"></i> Read Out</button>
            <button class="btn btn-outline btn-edit tooltip" data-id="${complaint.id}" data-tooltip="Admin Override" style="padding: 6px 12px; font-size:0.85em;"><i class="fas fa-user-cog"></i> Edit</button>
            ${complaint.status === "Pending" ? `<button class="btn btn-resolve" data-id="${complaint.id}" style="padding: 6px 12px; font-size:0.85em; background-color: var(--accent-green); color: #fff;"><i class="fas fa-check"></i> Mark Resolved</button>` : ``}
            <button class="btn btn-delete" data-id="${complaint.id}" style="padding: 6px 12px; font-size:0.85em; background-color: var(--accent-red); color:#fff;"><i class="fas fa-trash-alt"></i> Delete</button>
        </div>
    `;
    return card;
};

// Chart.js visual updates
const updateAnalyticsCharts = (complaints) => {
    const categories = ["Garbage", "Road Damage", "Water Leakage", "Street Light", "Other"];
    const categoryCounts = categories.map(cat => complaints.filter(c => c.category === cat).length);

    const ctx = document.getElementById("categoryChart").getContext("2d");
    
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    const isDarkMode = document.body.classList.contains("dark-mode");
    const labelColor = isDarkMode ? "#E2E8F0" : "#1E293B";

    categoryChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: categories,
            datasets: [{
                label: "Complaint Density by Category",
                data: categoryCounts,
                backgroundColor: [
                    "#EF4444", // Garbage
                    "#F59E0B", // Road Damage
                    "#3B82F6", // Water Leakage
                    "#10B981", // Street Light
                    "#6366F1"  // Other
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "right",
                    labels: {
                        color: labelColor,
                        font: {
                            family: "Poppins"
                        }
                    }
                }
            }
        }
    });
};

// AI Insights Cognitive summary auto compiler
const updateAIInsights = (complaints) => {
    if (complaints.length === 0) {
        document.getElementById("ai-top-category").textContent = "N/A";
        document.getElementById("ai-top-location").textContent = "N/A";
        document.getElementById("ai-mean-resolution").textContent = "N/A";
        document.getElementById("ai-system-recommendation").textContent = "Please submit complaints to start the neural summarization engine.";
        return;
    }

    // Category counter
    const categoryMap = {};
    const locationMap = {};
    complaints.forEach(c => {
        categoryMap[c.category] = (categoryMap[c.category] || 0) + 1;
        locationMap[c.location] = (locationMap[c.location] || 0) + 1;
    });

    const topCategory = Object.keys(categoryMap).reduce((a, b) => categoryMap[a] > categoryMap[b] ? a : b);
    const topLocation = Object.keys(locationMap).reduce((a, b) => locationMap[a] > locationMap[b] ? a : b);

    document.getElementById("ai-top-category").textContent = topCategory;
    document.getElementById("ai-top-location").textContent = topLocation;
    document.getElementById("ai-mean-resolution").textContent = "~28 Hours";

    // Dynamic custom smart strategic recommendations
    let suggestion = "";
    if (topCategory === "Water Leakage") {
        suggestion = `Substantial pipe stress detected near "${topLocation}". Civic administration recommends initiating smart pressure testing across the district sewage pipes immediately.`;
    } else if (topCategory === "Street Light") {
        suggestion = `High density of outages around "${topLocation}". AI suggests optimizing illumination using LED auto-sensing devices to reduce future electrical outages.`;
    } else if (topCategory === "Garbage") {
        suggestion = `Frequent trash pileups reported in "${topLocation}". Scheduling optimal heavy waste transit routines during off-peak hours could reduce clean-up queues.`;
    } else {
        suggestion = `Consolidated analysis indicates localized infrastructural maintenance in "${topLocation}" will yield the highest municipal service performance index improvement.`;
    }
    document.getElementById("ai-system-recommendation").textContent = suggestion;
};

// Geo Simulation Map Markers Updater
const updateSimulationMap = (complaints) => {
    const markersLayer = document.getElementById("markers-layer");
    markersLayer.innerHTML = "";

    const listContainer = document.getElementById("map-events-list");
    listContainer.innerHTML = "";

    complaints.forEach((complaint, idx) => {
        // Resolve coords or assign a pseudo-random location centered in the city blueprint
        let coords = locationCoordMap[complaint.location];
        if (!coords) {
            // Pseudo hash coordinate based on name length to pin on blueprint persistently
            const seed = complaint.location.length * 7;
            coords = {
                x: 15 + (seed % 70),
                y: 15 + ((seed * 11) % 70)
            };
        }

        // Color mapped priority
        let color = "#3B82F6";
        if (complaint.category === "Garbage") color = "#EF4444";
        else if (complaint.category === "Road Damage") color = "#F59E0B";
        else if (complaint.category === "Street Light") color = "#10B981";

        // Create Map Pin Element
        const marker = document.createElement("div");
        marker.className = "map-marker";
        marker.style.left = `${coords.x}%`;
        marker.style.top = `${coords.y}%`;
        marker.style.borderColor = color;
        marker.style.background = color;
        marker.title = `[Click] Complaint #${complaint.id.substring(0,6)}: ${complaint.description}`;
        
        marker.addEventListener("click", () => {
            showToast(`Focusing: Complaint #${complaint.id.substring(0, 8)} in ${complaint.location}`, "success");
            // Highlight list visual element
            const listEl = document.getElementById(`map-item-${complaint.id}`);
            if (listEl) {
                listEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
                listEl.style.borderColor = "var(--primary-color)";
                setTimeout(() => { listEl.style.borderColor = "var(--border-color)"; }, 1500);
            }
        });

        markersLayer.appendChild(marker);

        // Sidebar list item
        const listItem = document.createElement("div");
        listItem.id = `map-item-${complaint.id}`;
        listItem.className = "map-event-item";
        listItem.innerHTML = `
            <strong>#${complaint.id.substring(0, 6).toUpperCase()}</strong> - ${complaint.category}<br>
            <span style="font-size:0.8em; opacity:0.8;"><i class="fas fa-map-marker-alt"></i> ${complaint.location}</span>
        `;
        listItem.addEventListener("click", () => {
            showToast(`Navigating Blueprint to: ${complaint.location}`, "success");
            marker.style.transform = "translate(-50%, -50%) scale(2.2)";
            setTimeout(() => { marker.style.transform = "translate(-50%, -50%) scale(1)"; }, 1200);
        });
        listContainer.appendChild(listItem);
    });
};

// Counter animations for dashboard visual numbers
const animateDashboardCounters = () => {
    const counters = document.querySelectorAll('.counter');
    counters.forEach(counter => {
        const target = +counter.textContent;
        let count = 0;
        const speed = Math.max(1, Math.floor(target / 40));
        
        const updateCount = () => {
            if (count < target) {
                count += speed;
                if (count > target) count = target;
                counter.textContent = count;
                setTimeout(updateCount, 15);
            } else {
                counter.textContent = target;
            }
        };
        updateCount();
    });
};

// Dashboard Stats Refresh Layer
const refreshDashboard = (filteredList = getComplaints()) => {
    const allComplaints = getComplaints();
    
    // Core updates
    document.getElementById("total-complaints").textContent = allComplaints.length;
    document.getElementById("high-priority-complaints").textContent = allComplaints.filter(c => c.priority === "High").length;
    document.getElementById("pending-complaints").textContent = allComplaints.filter(c => c.status === "Pending").length;
    document.getElementById("resolved-complaints").textContent = allComplaints.filter(c => c.status === "Resolved").length;

    // Resolution progress metrics
    const resolvedCount = allComplaints.filter(c => c.status === "Resolved").length;
    const progressPercentage = allComplaints.length > 0 ? Math.round((resolvedCount / allComplaints.length) * 100) : 0;
    
    document.getElementById("resolution-percentage").textContent = `${progressPercentage}%`;
    document.getElementById("resolution-progress-fill").style.width = `${progressPercentage}%`;

    // Render Cards
    const container = document.getElementById("complaints-container");
    container.innerHTML = "";

    if (filteredList.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; opacity:0.8;">
                <i class="fas fa-shield-cat" style="font-size: 3.5em; color: var(--primary-color); margin-bottom:15px; display:block;"></i>
                <h3>No Administrative Grievances Logged</h3>
                <p>System clean. No issues matched the active ledger filters.</p>
            </div>
        `;
    } else {
        filteredList.forEach(c => {
            container.appendChild(renderComplaintCard(c));
        });
    }

    // Refresh charts, AI panels & map graphics
    updateAnalyticsCharts(allComplaints);
    updateAIInsights(allComplaints);
    updateSimulationMap(allComplaints);
};

// Filter Logic Centralized
const applyFilters = () => {
    const searchTerm = document.getElementById("search-input").value.toLowerCase();
    const filterCategory = document.getElementById("filter-category").value;
    const filterStatus = document.getElementById("filter-status").value;
    const filterPriority = document.getElementById("filter-priority") ? document.getElementById("filter-priority").value : "all";

    const complaints = getComplaints();

    const filtered = complaints.filter(c => {
        const matchesSearch = (
            c.name.toLowerCase().includes(searchTerm) ||
            c.description.toLowerCase().includes(searchTerm) ||
            c.location.toLowerCase().includes(searchTerm) ||
            c.id.toLowerCase().includes(searchTerm)
        );

        const matchesCategory = filterCategory === "all" || c.category === filterCategory;
        const matchesStatus = filterStatus === "all" || c.status === filterStatus;
        const matchesPriority = filterPriority === "all" || c.priority === filterPriority;

        return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
    });

    refreshDashboard(filtered);
};

// Secure Sanitizer preventing cross site scripting attacks (XSS Security standard)
const sanitizeInput = (text) => {
    const temp = document.createElement("div");
    temp.textContent = text;
    return temp.innerHTML;
};

// Form submission processor
const handleFormSubmit = (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const catSelect = document.getElementById("category");
    const locInput = document.getElementById("location");
    const descInput = document.getElementById("description");

    // Reset errors
    document.querySelectorAll(".error-msg").forEach(el => el.textContent = "");

    let isValid = true;

    // Check name
    if (!nameInput.value.trim()) {
        document.getElementById("name-error").textContent = "Full name is required.";
        isValid = false;
    }
    // Check email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.value.trim())) {
        document.getElementById("email-error").textContent = "Provide a valid email address.";
        isValid = false;
    }
    // Check Category
    if (!catSelect.value) {
        document.getElementById("category-error").textContent = "Please select a civic category.";
        isValid = false;
    }
    // Check Location
    if (!locInput.value.trim()) {
        document.getElementById("location-error").textContent = "Incident address location is required.";
        isValid = false;
    }
    // Check description
    if (descInput.value.trim().length < 15) {
        document.getElementById("description-error").textContent = "Description must be at least 15 characters long.";
        isValid = false;
    }

    if (!isValid) {
        showToast("Form validation failed. Please inspect inputs.", "error");
        return;
    }

    // Check for potential duplicate reports
    const allComplaints = getComplaints();
    const isDuplicate = allComplaints.some(c => 
        c.category === catSelect.value && 
        c.location.toLowerCase().trim() === locInput.value.toLowerCase().trim() &&
        c.status === "Pending"
    );

    if (isDuplicate) {
        showToast("A pending duplicate report already exists for this category/location.", "error");
        return;
    }

    showLoading("Evaluating neural text vectors & assigning priority weights...");

    // Simulated network/AI synthesis delay (1.2 seconds)
    setTimeout(() => {
        const sanitizedDesc = sanitizeInput(descInput.value);
        const { priority, department, resolutionTime } = assignComplaintDetails(catSelect.value, sanitizedDesc);

        const newReport = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            name: sanitizeInput(nameInput.value),
            email: sanitizeInput(emailInput.value),
            category: catSelect.value,
            location: sanitizeInput(locInput.value),
            description: sanitizedDesc,
            priority,
            department,
            resolutionTime,
            status: "Pending",
            timestamp: new Date().toISOString()
        };

        allComplaints.push(newReport);
        saveComplaints(allComplaints);
        
        hideLoading();
        showToast("Civic complaint registered successfully. Routed to Dept.", "success");
        
        document.getElementById("complaint-form").reset();
        document.getElementById("complaint-form-section").style.display = "none";
        
        refreshDashboard();
    }, 1200);
};

// Admin overriding / modification engine
const openEditModal = (id) => {
    const list = getComplaints();
    const comp = list.find(c => c.id === id);
    if (!comp) return;

    document.getElementById("edit-id").value = comp.id;
    document.getElementById("edit-name").value = comp.name;
    document.getElementById("edit-email").value = comp.email;
    document.getElementById("edit-category").value = comp.category;
    document.getElementById("edit-location").value = comp.location;
    document.getElementById("edit-description").value = comp.description;
    document.getElementById("edit-status").value = comp.status;

    document.getElementById("edit-modal").style.display = "flex";
};

// Voice Speech Dictation using Web Speech API
const setupVoiceDictation = () => {
    const voiceBtn = document.getElementById("voice-input-btn");
    const descArea = document.getElementById("description");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceBtn.style.display = "none";
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;

    voiceBtn.addEventListener("click", () => {
        showToast("Voice mode active. Start speaking...", "success");
        voiceBtn.classList.add("active");
        voiceBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Listening...`;
        recognition.start();
    });

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        descArea.value += (descArea.value ? " " : "") + text;
        showToast("Speech dictation processed.", "success");
    };

    recognition.onerror = () => {
        showToast("Dictation failed. Try speaking louder.", "error");
    };

    recognition.onend = () => {
        voiceBtn.classList.remove("active");
        voiceBtn.innerHTML = `<i class="fas fa-microphone"></i> Dictate Text`;
    };
};

// Read out loud with SpeechSynthesis API
const speakText = (text) => {
    if (!("speechSynthesis" in window)) {
        showToast("TTS not supported in this browser.", "error");
        return;
    }
    // Cancel prior speech first
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    showToast("Reading description...", "success");
};

// Export features: Dashboard data as CSV
const exportToCSV = () => {
    const list = getComplaints();
    if (list.length === 0) {
        showToast("No data to export.", "error");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID,Name,Email,Category,Location,Priority,Department,EstTime,Status,Timestamp\n";
    list.forEach(c => {
        const row = [
            c.id,
            `"${c.name}"`,
            c.email,
            c.category,
            `"${c.location}"`,
            c.priority,
            `"${c.department}"`,
            c.resolutionTime,
            c.status,
            c.timestamp
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SmartCivic_Grievance_Ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV Ledger exported successfully.", "success");
};

// Undo system stack handler
const undoDelete = () => {
    if (lastDeletedComplaint) {
        const list = getComplaints();
        list.push(lastDeletedComplaint);
        saveComplaints(list);
        lastDeletedComplaint = null;
        document.getElementById("undo-bar").classList.remove("show");
        if (undoTimeoutId) clearTimeout(undoTimeoutId);
        refreshDashboard();
        showToast("Deleted record recovered successfully.", "success");
    }
};

// DOM Content Loaded Initialize System
document.addEventListener("DOMContentLoaded", () => {
    // Hide splash screen smoothly after loader simulation finishes
    setTimeout(() => {
        const splash = document.getElementById("splash-screen");
        splash.style.opacity = "0";
        setTimeout(() => {
            splash.style.display = "none";
            animateDashboardCounters();
        }, 800);
    }, 2200);

    // Initial system refresh
    refreshDashboard();
    setupVoiceDictation();

    // Attach form actions
    document.getElementById("complaint-form").addEventListener("submit", handleFormSubmit);

    // Top Header Actions
    document.getElementById("toggle-form-btn").addEventListener("click", () => {
        const formSec = document.getElementById("complaint-form-section");
        formSec.style.display = formSec.style.display === "none" ? "block" : "none";
        if (formSec.style.display === "block") {
            formSec.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Simulated Map Visibility Toggle
    document.getElementById("toggle-map-btn").addEventListener("click", () => {
        const mapSec = document.getElementById("map-section");
        mapSec.style.display = mapSec.style.display === "none" ? "block" : "none";
        if (mapSec.style.display === "block") {
            mapSec.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Floating FAB trigger
    document.getElementById("floating-lodge-btn").addEventListener("click", () => {
        const formSec = document.getElementById("complaint-form-section");
        formSec.style.display = "block";
        formSec.scrollIntoView({ behavior: 'smooth' });
    });

    // Scroll helpers
    document.getElementById("scroll-form-btn").addEventListener("click", () => {
        const formSec = document.getElementById("complaint-form-section");
        formSec.style.display = "block";
        formSec.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById("scroll-stats-btn").addEventListener("click", () => {
        document.getElementById("dashboard-section").scrollIntoView({ behavior: 'smooth' });
    });

    // PDF Dashboard Export
    document.getElementById("export-pdf-btn").addEventListener("click", () => {
        showToast("Generating system Print preview / PDF...", "success");
        window.print();
    });

    // CSV Export
    document.getElementById("export-csv-btn").addEventListener("click", exportToCSV);

    // Filter controls event hook
    document.getElementById("search-input").addEventListener("input", applyFilters);
    document.getElementById("filter-category").addEventListener("change", applyFilters);
    document.getElementById("filter-status").addEventListener("change", applyFilters);
    if (document.getElementById("filter-priority")) {
        document.getElementById("filter-priority").addEventListener("change", applyFilters);
    }

    // Modal close controls
    document.getElementById("close-modal-btn").addEventListener("click", () => {
        document.getElementById("edit-modal").style.display = "none";
    });
    document.getElementById("cancel-edit-btn").addEventListener("click", () => {
        document.getElementById("edit-modal").style.display = "none";
    });

    // Modal Save Change Submit
    document.getElementById("edit-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("edit-id").value;
        const list = getComplaints();
        const idx = list.findIndex(c => c.id === id);

        if (idx > -1) {
            list[idx].name = sanitizeInput(document.getElementById("edit-name").value);
            list[idx].email = sanitizeInput(document.getElementById("edit-email").value);
            list[idx].category = document.getElementById("edit-category").value;
            list[idx].location = sanitizeInput(document.getElementById("edit-location").value);
            list[idx].description = sanitizeInput(document.getElementById("edit-description").value);
            list[idx].status = document.getElementById("edit-status").value;

            // Recalculate automated routing details
            const updatedAI = assignComplaintDetails(list[idx].category, list[idx].description);
            list[idx].priority = updatedAI.priority;
            list[idx].department = updatedAI.department;
            list[idx].resolutionTime = updatedAI.resolutionTime;

            saveComplaints(list);
            refreshDashboard();
            document.getElementById("edit-modal").style.display = "none";
            showToast("Record parameters overriden & auto-reassigned.", "success");
        }
    });

    // Undo delete trigger hook
    document.getElementById("undo-btn").addEventListener("click", undoDelete);

    // Clear whole database handler
    document.getElementById("clear-all-data").addEventListener("click", () => {
        if (confirm("Are you sure you want to clear all data? This deletes simulated records permanently.")) {
            localStorage.removeItem("civic_complaints");
            refreshDashboard([]);
            showToast("Database wiped clean.", "success");
        }
    });

    // Global card lists delegates trigger
    document.getElementById("complaints-container").addEventListener("click", (e) => {
        const target = e.target;

        // Mark as Resolved Action
        if (target.closest(".btn-resolve")) {
            const id = target.closest(".btn-resolve").dataset.id;
            const list = getComplaints();
            const idx = list.findIndex(c => c.id === id);
            if (idx > -1) {
                list[idx].status = "Resolved";
                saveComplaints(list);
                refreshDashboard();
                showToast("Incident status set to Resolved.", "success");
            }
        }

        // Delete action with undo stack integration
        if (target.closest(".btn-delete")) {
            const id = target.closest(".btn-delete").dataset.id;
            const list = getComplaints();
            const idx = list.findIndex(c => c.id === id);
            if (idx > -1) {
                lastDeletedComplaint = list[idx];
                list.splice(idx, 1);
                saveComplaints(list);
                refreshDashboard();
                
                // Show Undo Snackbar
                const undoBar = document.getElementById("undo-bar");
                undoBar.classList.add("show");

                if (undoTimeoutId) clearTimeout(undoTimeoutId);
                undoTimeoutId = setTimeout(() => {
                    undoBar.classList.remove("show");
                    lastDeletedComplaint = null;
                }, 5000);
            }
        }

        // Edit Action
        if (target.closest(".btn-edit")) {
            const id = target.closest(".btn-edit").dataset.id;
            openEditModal(id);
        }

        // Readout Speech text Action
        if (target.closest(".btn-speak")) {
            const id = target.closest(".btn-speak").dataset.id;
            const list = getComplaints();
            const comp = list.find(c => c.id === id);
            if (comp) {
                speakText(`Complaint category is ${comp.category}. Reported by ${comp.name}. Issue detail says: ${comp.description}`);
            }
        }
    });

    // About Modal
    const aboutModal = document.getElementById("about-modal");
    document.getElementById("about-btn").addEventListener("click", () => {
        aboutModal.style.display = "flex";
    });
    document.getElementById("close-about-modal-btn").addEventListener("click", () => {
        aboutModal.style.display = "none";
    });

    // Theme Switch / Dark Mode Layer Listener
    const darkModeSwitch = document.getElementById("dark-mode-switch");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

    if (localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && prefersDark.matches)) {
        document.body.classList.add("dark-mode");
        darkModeSwitch.checked = true;
    }

    darkModeSwitch.addEventListener("change", () => {
        if (darkModeSwitch.checked) {
            document.body.classList.add("dark-mode");
            localStorage.setItem("theme", "dark");
            showToast("Admin vision set to Dark Mode.", "success");
        } else {
            document.body.classList.remove("dark-mode");
            localStorage.setItem("theme", "light");
            showToast("Admin vision set to Light Mode.", "success");
        }
        // Force refresh of Chart labels to dark/light color match
        refreshDashboard();
    });
});
