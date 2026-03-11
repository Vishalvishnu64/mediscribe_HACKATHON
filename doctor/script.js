document.addEventListener('DOMContentLoaded', () => {
    
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.addEventListener('click', loadData);

    // Initial load
    loadData();

    async function loadData() {
        try {
            // Update UI to show loading state
            const btnIcon = refreshBtn.querySelector('i');
            btnIcon.classList.add('ri-spin');
            
            const response = await fetch('http://127.0.0.1:5000/api/prescriptions');
            const result = await response.json();
            
            if (result.success) {
                const prescriptions = result.data;
                updateDashboard(prescriptions);
            } else {
                console.error("Failed to fetch data:", result.error);
                showError("Failed to load prescription data.");
            }
        } catch (error) {
            console.error("Error loading data:", error);
            showError("Cannot connect to server. Ensure Flask backend is running.");
        } finally {
            // Remove loading state
            setTimeout(() => {
                const btnIcon = refreshBtn.querySelector('i');
                if(btnIcon) btnIcon.classList.remove('ri-spin');
            }, 500);
        }
    }

    function updateDashboard(prescriptions) {
        // 1. Update Stats
        document.getElementById('stat-total').textContent = prescriptions.length;
        
        // Count unique patients
        const uniquePatients = new Set();
        prescriptions.forEach(p => {
            if (p.extracted_data && p.extracted_data.patient && p.extracted_data.patient.name) {
                uniquePatients.add(p.extracted_data.patient.name.toLowerCase());
            }
        });
        document.getElementById('stat-patients').textContent = uniquePatients.size;

        // 2. Update Timeline (Recent Prescriptions)
        const timelineContainer = document.getElementById('recent-prescriptions');
        timelineContainer.innerHTML = ''; // Clear loading state
        
        if (prescriptions.length === 0) {
            timelineContainer.innerHTML = `
                <div class="slot" style="text-align:center; padding: 2rem; color: var(--muted); border: 2px dashed var(--line); display: block;">
                    <p>No prescriptions found.</p>
                </div>
            `;
        } else {
            // Take top 4 most recent
            const recent = prescriptions.slice(0, 4);
            
            recent.forEach(p => {
                const data = p.extracted_data || {};
                const patient = data.patient || {};
                const name = patient.name || "Unknown Patient";
                
                // Format date (use extraction date if available, otherwise upload time)
                let dateStr = "Recent";
                if (p.uploaded_at) {
                    const d = new Date(p.uploaded_at);
                    dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }

                // Determine tag/status based on confidence or other factors
                let tagClass = "tag";
                let tagText = "Processed";
                
                if (data.confidence === "low") {
                    tagClass = "tag warn";
                    tagText = "Low Confidence";
                }

                // Get a quick summary of meds
                let medCount = 0;
                let purposeText = "No medications listed";
                if (data.medicines && Array.isArray(data.medicines)) {
                    medCount = data.medicines.length;
                    if (medCount > 0) {
                        purposeText = `${medCount} medication${medCount > 1 ? 's' : ''} prescribed`;
                        // E.g., Paracetamol, Amoxicillin...
                        const medNames = data.medicines.slice(0, 2).map(m => m.name).join(', ');
                        if (medNames) {
                            purposeText = medNames + (medCount > 2 ? '...' : '');
                        }
                    }
                }

                const slotHTML = `
                    <div class="slot">
                        <p class="time">${dateStr}</p>
                        <div>
                            <p class="patient">${name}</p>
                            <p class="purpose">${purposeText}</p>
                        </div>
                        <span class="${tagClass}">${tagText}</span>
                    </div>
                `;
                timelineContainer.insertAdjacentHTML('beforeend', slotHTML);
            });
        }

        // 3. Update Patient Directory Table
        const tableBody = document.getElementById('patient-directory');
        tableBody.innerHTML = '';
        
        if (prescriptions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding: 2rem; color: var(--muted);">
                        No patient records found.
                    </td>
                </tr>
            `;
            return;
        }

        // We'll show the latest prescription for each patient, but for simplicity here we list all rx records
        prescriptions.forEach(p => {
            const data = p.extracted_data || {};
            const patient = data.patient || {};
            
            const name = patient.name || "Unknown";
            const age = patient.age && patient.age !== "null" ? patient.age : "-";
            const gender = patient.gender && patient.gender !== "null" ? patient.gender : "-";
            const ageGender = (age !== "-" || gender !== "-") ? `${age} / ${gender}` : "Unknown";
            
            let dateStr = "Unknown";
            if (data.doctor && data.doctor.date && data.doctor.date !== "null") {
                dateStr = data.doctor.date;
            } else if (p.uploaded_at) {
                const d = new Date(p.uploaded_at);
                dateStr = d.toLocaleDateString();
            }

            let statusPill = `<span class="pill stable">Active</span>`;
            if (data.confidence === "low") {
                statusPill = `<span class="pill review">Review Required</span>`;
            } else if (data.instructions && data.instructions.warnings && data.instructions.warnings !== "null") {
                statusPill = `<span class="pill urgent">Has Warnings</span>`;
            }

            const trHTML = `
                <tr>
                    <td style="font-weight: 500;">${name === "null" ? "Unknown" : name}</td>
                    <td>${ageGender}</td>
                    <td>${dateStr}</td>
                    <td>${statusPill}</td>
                    <td>
                        <button style="background:transparent; color:var(--primary); padding:4px 8px; font-size:1.1rem; box-shadow:none;">
                            <i class="ri-eye-line"></i>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', trHTML);
        });
        
        // Update pending review count
        const lowConfCount = prescriptions.filter(p => p.extracted_data && p.extracted_data.confidence === "low").length;
        document.getElementById('pending-count').textContent = lowConfCount;
    }

    function showError(msg) {
        document.getElementById('recent-prescriptions').innerHTML = `
            <div class="slot" style="text-align:center; padding: 2rem; color: var(--alert); display: block; border: 2px dashed #f5c1c8; background: #fff0f2;">
                <i class="ri-error-warning-line" style="font-size: 2rem;"></i>
                <p style="margin-top: 10px;">${msg}</p>
            </div>
        `;
    }
});
