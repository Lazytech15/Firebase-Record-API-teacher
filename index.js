        // teacher.js

        // Add at the top with other variables
let pollingInterval = null;
const POLLING_DELAY = 5000; // 5 seconds

// Function to start polling updates
function startPollingUpdates() {
    const currentSection = document.getElementById('section').value;
    if (!currentSection) {
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
            const response = await fetch(`${API_URL}/attendance`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch attendance data');
            }

            const data = await response.json();
            
            // Filter data based on section
            const newAttendanceData = Object.values(data || {}).filter(entry => 
                entry.section === currentSection
            );

            // Sort by time in descending order
            newAttendanceData.sort((a, b) => 
                new Date(b.timeIn) - new Date(a.timeIn)
            );

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

        // Replace with your Netlify Function URL
        const API_URL = 'https://project-to-ipt01.netlify.app/.netlify/functions/api';
        let attendanceData = [];
        let html5QrcodeScanner = null;

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
                type: 'attendance' // Add type to identify QR code purpose
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
    // If scanner is locked, return immediately
    if (scannerLocked) {
        return;
    }
    
    // Lock the scanner
    scannerLocked = true;
    
    try {
        const currentSection = document.getElementById('section').value;
        if (!currentSection) {
            throw new Error('Please set the section first');
        }

        // Check if student already has attendance for today
        const today = new Date().toLocaleDateString();
        const existingAttendance = attendanceData.find(entry => 
            entry.studentId === studentId && 
            new Date(entry.timeIn).toLocaleDateString() === today
        );

        if (existingAttendance) {
            throw new Error('Student attendance already recorded for today');
        }

        // First, fetch student data
        const studentResponse = await fetch(`${API_URL}/students/${studentId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!studentResponse.ok) {
            throw new Error('Student not found');
        }

        const studentData = await studentResponse.json();

        // Verify if student belongs to the current section
        if (studentData.section !== currentSection) {
            throw new Error(`Student does not belong to section ${currentSection}`);
        }

        // Create attendance entry
        const attendanceEntry = {
            studentId: studentData.studentId,
            name: studentData.name,
            course: studentData.course,
            section: currentSection,
            timeIn: new Date().toISOString(),
            subject: document.getElementById('subject').value
        };

        // Save attendance record
        const attendanceResponse = await fetch(`${API_URL}/attendance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(attendanceEntry)
        });

        if (!attendanceResponse.ok) {
            throw new Error('Failed to save attendance');
        }

        // Update local data and table
        attendanceData.push(attendanceEntry);
        updateAttendanceTable();
        
        // Stop the scanner after successful scan
        if (html5QrcodeScanner) {
            html5QrcodeScanner.pause();
        }
        
        await Swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Attendance recorded successfully!'
        });
        
        // Resume scanner after alert is closed
        if (html5QrcodeScanner) {
            html5QrcodeScanner.resume();
        }
        
    } catch (error) {
        console.error('Error:', error);
        
        // Stop the scanner before showing error
        if (html5QrcodeScanner) {
            html5QrcodeScanner.pause();
        }
        
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message
        });
        
        // Resume scanner after error alert is closed
        if (html5QrcodeScanner) {
            html5QrcodeScanner.resume();
        }
    } finally {
        // Unlock the scanner after processing is complete
        scannerLocked = false;
    }
}

                // New function to show export options
                function showExportOptions() {
            Swal.fire({
                title: 'Choose Export Format',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'XLSX',
                cancelButtonText: 'CSV',
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
            const subject = document.getElementById('subject').value;
            const section = document.getElementById('section').value;
            const currentDate = new Date().toLocaleDateString();
            const currentTime = new Date().toLocaleTimeString();
        
            // Create worksheet data
            const ws_data = [
                ['ATTENDANCE RECORD FOR'],
                [`Date: ${currentDate} Time: ${currentTime}`],
                [`Subject: ${subject} Section: ${section}`],
                [''], // Empty row
                ['Student ID', 'Name', 'Course', 'Section', 'Time-in']
            ];
        
            // Add attendance data
            attendanceData.forEach(entry => {
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
            XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        
            // Auto-size columns
            const cols = ws_data[4].length;
            ws['!cols'] = Array(cols).fill({ wch: 15 });
        
            // Save file
            XLSX.writeFile(wb, `Attendance_${currentDate.replace(/\//g, '-')}.xlsx`);
        
            // Delete the exported data
            await deleteAttendanceData(section);
        }

        // Function to export to CSV
        async function exportToCSV() {
            const subject = document.getElementById('subject').value;
            const section = document.getElementById('section').value;
            const currentDate = new Date().toLocaleDateString();
            const currentTime = new Date().toLocaleTimeString();

            let csvContent = `ATTENDANCE RECORD FOR\n`;
            csvContent += `Date: ${currentDate} Time: ${currentTime}\n`;
            csvContent += `Subject: ${subject} Section: ${section}\n\n`;
            csvContent += `Student ID,Name,Course,Section,Time-in\n`;

            attendanceData.forEach(entry => {
                csvContent += `${entry.studentId},${entry.name},${entry.course},${entry.section},${new Date(entry.timeIn).toLocaleString()}\n`;
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Attendance_${currentDate.replace(/\//g, '-')}.csv`;
            link.click();

            // Delete the exported data
            await deleteAttendanceData(section);
        }

        // Function to load existing attendance data
        async function loadExistingAttendance() {
            try {
                const currentSection = document.getElementById('section').value;
                if (!currentSection) {
                    return;
                }
        
                const response = await fetch(`${API_URL}/attendance`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
        
                if (!response.ok) {
                    return;
                }
        
                const data = await response.json();
                // Filter data based on section
                attendanceData = Object.values(data || {}).filter(entry => 
                    entry.section === currentSection
                );
                updateAttendanceTable();
            } catch (error) {
                console.error('Error loading attendance data:', error);
            }
        }

        // Function to update the attendance table
        function updateAttendanceTable() {
            const tbody = document.getElementById('attendanceTable');
            tbody.innerHTML = attendanceData.map(entry => `
                <tr>
                    <td>${entry.studentId}</td>
                    <td>${entry.name}</td>
                    <td>${entry.course}</td>
                    <td>${entry.section}</td>
                    <td>${new Date(entry.timeIn).toLocaleString()}</td>
                </tr>
            `).join('');
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

// Add event listener when the document loads
document.addEventListener('DOMContentLoaded', () => {
    const sectionInput = document.getElementById('section');
    sectionInput.addEventListener('blur', loadExistingAttendance);
    loadExistingAttendance(); // Initial load
});
