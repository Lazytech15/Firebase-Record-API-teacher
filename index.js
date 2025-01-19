        // teacher.js
        const API_URL = 'https://project-to-ipt01.netlify.app/.netlify/functions/api';
        let attendanceData = [];
        let html5QrcodeScanner = null;
        let pollingInterval = null;
        const POLLING_DELAY = 5000;
        let availableSections = new Set();
        let debounceTimer;


        // Modal functions
function openQRModal() {
    document.getElementById('qrModal').style.display = 'block';
    generateQR();
}

function closeQRModal() {
    document.getElementById('qrModal').style.display = 'none';
}

function openScannerModal() {
    document.getElementById('scannerModal').style.display = 'block';
    initScanner();
}

function closeScannerModal() {
    document.getElementById('scannerModal').style.display = 'none';
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
    }
}

// Section handling
function parseSections(sectionInput) {
    return sectionInput.split(',').map(s => s.trim()).filter(s => s);
}

function updateSectionChips() {
    const sectionInput = document.getElementById('section').value;
    const sections = parseSections(sectionInput);
    const chipsContainer = document.getElementById('sectionChips');
    
    chipsContainer.innerHTML = sections.map(section => 
        `<span class="section-chip" onclick="selectSection('${section}')">${section}</span>`
    ).join('');
}

function selectSection(section) {
    document.getElementById('section').value = section;
    updateSectionChips();
    loadExistingAttendance();
}

// Show/hide loading spinner
function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

function initScanner() {
    if (html5QrcodeScanner === null) {
        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 250 } }
        );
        
        html5QrcodeScanner.render((decodedText) => {
            processStudentAttendance(decodedText);
        }, (error) => {
            console.warn(`Code scan error = ${error}`);
        });
    }
}
        
        // Function to start polling updates
        function startPollingUpdates() {
            const currentSection = document.getElementById('section').value;
            const sections = parseSections(currentSection);
            
            if (!sections.length) {
                return;
            }
        
            // Clear any existing polling
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        
            // Initial load
            loadExistingAttendance();
        
            // Set up polling
            pollingInterval = setInterval(async () => {
                try {
                    const response = await fetch(`${API_URL}/attendance`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch attendance data');
                    }
        
                    const data = await response.json();
                    const newAttendanceData = Object.values(data || {})
                        .filter(entry => sections.includes(entry.section))
                        .sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));
        
                    // Check if data has changed
                    const hasChanged = JSON.stringify(attendanceData) !== JSON.stringify(newAttendanceData);
                    
                    if (hasChanged) {
                        attendanceData = newAttendanceData;
                        updateAttendanceTable();
                    }
                } catch (error) {
                    console.error('Error polling attendance data:', error);
                }
            }, POLLING_DELAY);
        }
        
        // Modified event listener for section input
        document.addEventListener('DOMContentLoaded', () => {
            const sectionInput = document.getElementById('section');
            sectionInput.addEventListener('blur', () => {
                startPollingUpdates();
            });
            
            // Start initial polling if section is already set
            if (sectionInput.value) {
                startPollingUpdates();
            }
        });
        
        // Modify the updateAttendanceTable function to include animation
        function updateAttendanceTable() {
            const tbody = document.getElementById('attendanceTable');
            
            // Create new table content
            const newContent = attendanceData.map(entry => `
                <tr class="fade-in">
                    <td>${entry.studentId}</td>
                    <td>${entry.name}</td>
                    <td>${entry.course}</td>
                    <td>${entry.section}</td>
                    <td>${new Date(entry.timeIn).toLocaleString()}</td>
                </tr>
            `).join('');
            
            // Only update if content has changed
            if (tbody.innerHTML !== newContent) {
                tbody.innerHTML = newContent;
            }
        }
        
        // Clean up function to stop polling when needed
        function cleanupPolling() {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        }
        
        // Add cleanup on page unload
        window.addEventListener('beforeunload', cleanupPolling);
        
        // Add cleanup when changing sections
        document.getElementById('section').addEventListener('change', () => {
            cleanupPolling();
            startPollingUpdates();
        });

        
                // Function to generate QR code
                function generateQR() {
                    const subject = document.getElementById('subject').value;
                    const section = document.getElementById('section').value;
                    
                    if (!subject || !section) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Invalid Input',
                            text: 'Please fill in both subject and section!'
                        });
                        return;
                    }
                
                    const qrData = JSON.stringify({ 
                        subject, 
                        section, 
                        timestamp: new Date().toISOString(),
                        type: 'attendance'
                    });
                    
                    const qrCodeDiv = document.getElementById('qrCode');
                    qrCodeDiv.innerHTML = '';
                    
                    new QRCode(qrCodeDiv, {
                        text: qrData,
                        width: 256,
                        height: 256
                    });
                }
                
                // New function to delete attendance data
                async function deleteAttendanceData(section) {
                    try {
                        const response = await fetch(`${API_URL}/attendance/delete/${section}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                
                        if (!response.ok) {
                            throw new Error('Failed to delete attendance data');
                        }
                
                        // Clear local data and update table
                        attendanceData = [];
                        updateAttendanceTable();
                
                        await Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Attendance data has been exported and deleted successfully!'
                        });
                    } catch (error) {
                        console.error('Error deleting attendance data:', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Failed to delete attendance data'
                        });
                    }
                }
        
                let scannerLocked = false; // Add this at the top with other global variables
        
        // Function to process student attendance
        async function processStudentAttendance(studentId) {
            showLoading();
            try {
                const currentSection = document.getElementById('section').value;
                const sections = parseSections(currentSection);
                
                if (!sections.length) {
                    throw new Error('Please set at least one section');
                }
            
                const studentResponse = await fetch(`${API_URL}/students/${studentId}`);
                if (!studentResponse.ok) {
                    throw new Error('Student not found');
                }
            
                const studentData = await studentResponse.json();
                
                // Get the student's section
                const studentSection = studentData.section;

                console.log(studentSection);
                
                // Split the input sections by comma and check if the student's section matches any of them
                const inputSections = studentSection.split(',');

                console.log(inputSections);
                if (!inputSections.includes(sections)) {
                    throw new Error(`Student does not belong to sections: ${sections}`);
                }
            
                // Check for existing attendance
                const today = new Date().toLocaleDateString();
                const existingAttendance = attendanceData.find(entry => 
                    entry.studentId === studentId && 
                    new Date(entry.timeIn).toLocaleDateString() === today
                );
            
                if (existingAttendance) {
                    throw new Error('Student attendance already recorded for today');
                }
            
                const attendanceEntry = {
                    studentId: studentData.studentId,
                    name: studentData.name,
                    course: studentData.course,
                    section: studentSection,
                    timeIn: new Date().toISOString(),
                    subject: document.getElementById('subject').value
                };
            
                const attendanceResponse = await fetch(`${API_URL}/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(attendanceEntry)
                });
            
                if (!attendanceResponse.ok) {
                    throw new Error('Failed to save attendance');
                }
            
                attendanceData.push(attendanceEntry);
                updateAttendanceTable();
                
                await Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Attendance recorded successfully!'
                });
                
            } catch (error) {
                console.error('Error:', error);
                await Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message
                });
            } finally {
                hideLoading();
            }
        }
        
        
        
        function showExportOptions() {
            Swal.fire({
                title: 'Choose Export Format',
                icon: 'question',
                html: `
                    <div class="flex flex-col space-y-4">
                        <button class="btn btn-primary" onclick="Swal.clickConfirm()">Export to Excel (XLSX)</button>
                        <button class="btn btn-info" onclick="Swal.clickCancel()">Export to CSV</button>
                    </div>
                `,
                showConfirmButton: false,
                showCancelButton: false,
                showCloseButton: true
            }).then((result) => {
                if (result.isConfirmed) {
                    exportToExcel();
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    exportToCSV();
                }
            });
        }
        
                // Function to export to Excel
                async function exportToExcel() {
                    showLoading();
                    try {
                        const subject = document.getElementById('subject').value.toUpperCase();
                        const sections = parseSections(document.getElementById('section').value);
                        const currentDate = new Date().toLocaleDateString();
                        const currentTime = new Date().toLocaleTimeString();
                
                        // Create worksheet data with improved formatting
                        const ws_data = [
                            ['ATTENDANCE RECORD'],
                            [''],
                            ['Subject:', subject],
                            ['Sections:', sections.join(', ')],
                            ['Date:', currentDate],
                            ['Time:', currentTime],
                            [''],
                            ['STUDENT INFORMATION'],
                            ['Student ID', 'Name', 'Course', 'Section', 'Time-in']
                        ];
                
                        // Add attendance data sorted by time
                        const sortedData = [...attendanceData].sort((a, b) => 
                            new Date(b.timeIn) - new Date(a.timeIn)
                        );
                
                        sortedData.forEach(entry => {
                            ws_data.push([
                                entry.studentId,
                                entry.name,
                                entry.course,
                                entry.section,
                                new Date(entry.timeIn).toLocaleString()
                            ]);
                        });
                
                        const ws = XLSX.utils.aoa_to_sheet(ws_data);
                        const wb = XLSX.utils.book_new();
                
                        // Apply styles
                        ws['!merges'] = [
                            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
                            { s: { r: 7, c: 0 }, e: { r: 7, c: 4 } }
                        ];
                
                        // Set column widths
                        ws['!cols'] = [
                            { wch: 15 },  // Student ID
                            { wch: 30 },  // Name
                            { wch: 15 },  // Course
                            { wch: 10 },  // Section
                            { wch: 20 }   // Time-in
                        ];
                
                        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
                        XLSX.writeFile(wb, `Attendance_${subject}_${sections.join('-')}_${currentDate.replace(/\//g, '-')}.xlsx`);
                
                        // Delete exported data
                        for (const section of sections) {
                            await deleteAttendanceData(section);
                        }
                    } finally {
                        hideLoading();
                    }
                }
                
                async function exportToCSV() {
                    showLoading();
                    try {
                        const subject = document.getElementById('subject').value;
                        const sections = parseSections(document.getElementById('section').value);
                        const currentDate = new Date().toLocaleDateString();
                        const currentTime = new Date().toLocaleTimeString();
                
                        let csvContent = `ATTENDANCE RECORD\n`;
                        csvContent += `Date: ${currentDate} Time: ${currentTime}\n`;
                        csvContent += `Subject: ${subject}\n`;
                        csvContent += `Sections: ${sections.join(', ')}\n\n`;
                        csvContent += `Student ID,Name,Course,Section,Time-in\n`;
                
                        attendanceData.forEach(entry => {
                            csvContent += `${entry.studentId},${entry.name},${entry.course},${entry.section},${new Date(entry.timeIn).toLocaleString()}\n`;
                        });
                
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `Attendance_${sections.join('-')}_${currentDate.replace(/\//g, '-')}.csv`;
                        link.click();
                
                        // Delete exported data
                        for (const section of sections) {
                            await deleteAttendanceData(section);
                        }
                    } finally {
                        hideLoading();
                    }
                }
        
                async function loadExistingAttendance() {
                    showLoading();
                    try {
                        const currentSection = document.getElementById('section').value;
                        const sections = parseSections(currentSection);
                        
                        if (!sections.length) {
                            return;
                        }
                
                        const response = await fetch(`${API_URL}/attendance`);
                        if (!response.ok) {
                            throw new Error('Failed to fetch attendance data');
                        }
                
                        const data = await response.json();
                        attendanceData = Object.values(data || {}).filter(entry => 
                            sections.includes(entry.section)
                        ).sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));
                
                        updateAttendanceTable();
                    } catch (error) {
                        console.error('Error loading attendance data:', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Failed to load attendance data'
                        });
                    } finally {
                        hideLoading();
                    }
                }
                
        
                // Function to update the attendance table
                function updateAttendanceTable() {
                    const tbody = document.getElementById('attendanceTable');
                    
                    // Create new table content with fade-in animation
                    const newContent = attendanceData.map(entry => `
                        <tr class="fade-in">
                            <td>${entry.studentId}</td>
                            <td>${entry.name}</td>
                            <td>${entry.course}</td>
                            <td>${entry.section}</td>
                            <td>${new Date(entry.timeIn).toLocaleString()}</td>
                        </tr>
                    `).join('');
                    
                    // Only update if content has changed
                    if (tbody.innerHTML !== newContent) {
                        tbody.innerHTML = newContent;
                    }
                }
        
                function toggleScanner() {
            const readerDiv = document.getElementById('reader');
            
            if (readerDiv.classList.contains('hidden')) {
                readerDiv.classList.remove('hidden');
                
                if (html5QrcodeScanner === null) {
                    html5QrcodeScanner = new Html5QrcodeScanner(
                        "reader", 
                        { fps: 10, qrbox: { width: 250, height: 250 } }
                    );
                    
                    html5QrcodeScanner.render((decodedText) => {
                        processStudentAttendance(decodedText);
                    }, (error) => {
                        // Handle scan error silently to avoid multiple alerts
                        console.warn(`Code scan error = ${error}`);
                    });
                }
            } else {
                readerDiv.classList.add('hidden');
                if (html5QrcodeScanner) {
                    html5QrcodeScanner.clear();
                    html5QrcodeScanner = null;
                }
            }
        }
        
// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const sectionInput = document.getElementById('section');
    
    sectionInput.addEventListener('input', updateSectionChips);
    sectionInput.addEventListener('blur', () => {
        startPollingUpdates();
    });
    
    // Initial load
    updateSectionChips();
    loadExistingAttendance();

    // Close modals when clicking outside
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
            if (html5QrcodeScanner) {
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
            }
        }
    };
});

// Cleanup function
function cleanupPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// Add cleanup on page unload
window.addEventListener('beforeunload', cleanupPolling);
