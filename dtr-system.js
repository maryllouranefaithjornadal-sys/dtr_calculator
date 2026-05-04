// DTR System - Main JavaScript File

// ========================
// Global Variables
// ========================
let dtrRecords = [];
let uploadedRecords = [];
let designatedTimes = {
    morningIn: "08:00",
    morningOut: "12:00",
    afternoonIn: "13:00",
    afternoonOut: "17:00",
    gracePeriod: 0
};

// ========================
// Initialize on Page Load
// ========================
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    setEntryDateToToday();
    loadDTRRecords();
    updateDTRTable();
    updateSummary();
});

// ========================
// Settings Management
// ========================
function saveSettings() {
    designatedTimes.morningIn = document.getElementById('morningInTime').value;
    designatedTimes.morningOut = document.getElementById('morningOutTime').value;
    designatedTimes.afternoonIn = document.getElementById('afternoonInTime').value;
    designatedTimes.afternoonOut = document.getElementById('afternoonOutTime').value;
    designatedTimes.gracePeriod = parseInt(document.getElementById('gracePeriod').value) || 0;

    // Save to localStorage
    localStorage.setItem('dtrDesignatedTimes', JSON.stringify(designatedTimes));

    showAlert('Settings saved successfully!', 'success');
}

function loadSettings() {
    const saved = localStorage.getItem('dtrDesignatedTimes');
    if (saved) {
        designatedTimes = JSON.parse(saved);
        document.getElementById('morningInTime').value = designatedTimes.morningIn;
        document.getElementById('morningOutTime').value = designatedTimes.morningOut;
        document.getElementById('afternoonInTime').value = designatedTimes.afternoonIn;
        document.getElementById('afternoonOutTime').value = designatedTimes.afternoonOut;
        document.getElementById('gracePeriod').value = designatedTimes.gracePeriod;
    }
}

// ========================
// DTR Record Management
// ========================
function setEntryDateToToday() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entryDate').value = today;
}

function addDTRRecord() {
    const date = document.getElementById('entryDate').value;
    const employeeName = document.getElementById('employeeName').value;
    const morningIn = document.getElementById('morningInRecord').value;
    const morningOut = document.getElementById('morningOutRecord').value;
    const afternoonIn = document.getElementById('afternoonInRecord').value;
    const afternoonOut = document.getElementById('afternoonOutRecord').value;

    // Validation
    if (!date || !employeeName) {
        showAlert('Please fill in date and employee name', 'error');
        return;
    }

    if (!morningIn || !morningOut || !afternoonIn || !afternoonOut) {
        showAlert('Please fill in all time records', 'error');
        return;
    }

    // Create DTR Record
    const record = {
        id: Date.now(),
        date: date,
        employeeName: employeeName,
        morningIn: morningIn,
        morningOut: morningOut,
        afternoonIn: afternoonIn,
        afternoonOut: afternoonOut
    };

    // Calculate tardiness and hours
    record.morningStatus = checkTardiness(morningIn, designatedTimes.morningIn);
    record.afternoonStatus = checkTardiness(afternoonIn, designatedTimes.afternoonIn);
    record.hoursRendered = calculateHoursRendered(morningIn, morningOut, afternoonIn, afternoonOut, record.specialStatus);

    dtrRecords.push(record);
    saveDTRRecords();
    updateDTRTable();
    updateSummary();
    clearEntryForm();
    showAlert(`DTR Record added for ${employeeName}!`, 'success');
}

function clearEntryForm() {
    document.getElementById('employeeName').value = '';
    document.getElementById('morningInRecord').value = '';
    document.getElementById('morningOutRecord').value = '';
    document.getElementById('afternoonInRecord').value = '';
    document.getElementById('afternoonOutRecord').value = '';
    setEntryDateToToday();
}

function deleteDTRRecord(id) {
    if (confirm('Are you sure you want to delete this record?')) {
        dtrRecords = dtrRecords.filter(record => record.id !== id);
        saveDTRRecords();
        updateDTRTable();
        updateSummary();
        showAlert('Record deleted successfully', 'success');
    }
}

// ========================
// Tardiness Calculation
// ========================
function checkTardiness(actualTime, designatedTime) {
    if (!actualTime || !designatedTime) {
        return { status: 'absent', minutes: 0 };
    }

    const actualMinutes = timeToMinutes(actualTime);
    const designatedMinutes = timeToMinutes(designatedTime);
    const gracePeriod = designatedTimes.gracePeriod || 0;
    const lateThreshold = designatedMinutes + gracePeriod;

    if (actualMinutes <= lateThreshold) {
        return { 
            status: 'on-time', 
            minutes: 0,
            label: 'On Time'
        };
    } else {
        const lateMinutes = actualMinutes - lateThreshold;
        return { 
            status: 'late', 
            minutes: lateMinutes,
            label: `Late by ${lateMinutes}min`
        };
    }
}

// ========================
// Time Calculations
// ========================
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToHMS(totalMinutes) {
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;

    let result = [];
    if (days > 0) result.push(`${days}d`);
    if (hours > 0) result.push(`${hours}h`);
    if (mins > 0) result.push(`${mins}m`);

    return result.length > 0 ? result.join(' ') : '0m';
}

function calculateHoursRendered(morningIn, morningOut, afternoonIn, afternoonOut, specialStatus) {
    try {
        // If WFH or Travel, return full 8 hours
        if (specialStatus === 'WFH' || specialStatus === 'TRAVEL') {
            const morningShiftMinutes = timeToMinutes(designatedTimes.morningOut) - timeToMinutes(designatedTimes.morningIn);
            const afternoonShiftMinutes = timeToMinutes(designatedTimes.afternoonOut) - timeToMinutes(designatedTimes.afternoonIn);
            const totalMinutes = morningShiftMinutes + afternoonShiftMinutes;
            return {
                totalMinutes: totalMinutes,
                formatted: minutesToHMS(totalMinutes),
                hours: (totalMinutes / 60).toFixed(2)
            };
        }

        // Calculate max designated hours (4h morning + 4h afternoon = 8h total)
        const morningShiftMinutes = timeToMinutes(designatedTimes.morningOut) - timeToMinutes(designatedTimes.morningIn);
        const afternoonShiftMinutes = timeToMinutes(designatedTimes.afternoonOut) - timeToMinutes(designatedTimes.afternoonIn);
        let totalMinutes = morningShiftMinutes + afternoonShiftMinutes;

        // Deduct late minutes from morning
        if (morningIn) {
            const morningStatus = checkTardiness(morningIn, designatedTimes.morningIn);
            if (morningStatus.status === 'late') {
                totalMinutes -= morningStatus.minutes;
            }
        } else {
            // No morning in time - deduct entire morning shift
            totalMinutes -= morningShiftMinutes;
        }

        // Deduct late minutes from afternoon
        if (afternoonIn) {
            const afternoonStatus = checkTardiness(afternoonIn, designatedTimes.afternoonIn);
            if (afternoonStatus.status === 'late') {
                totalMinutes -= afternoonStatus.minutes;
            }
        } else {
            // No afternoon in time - deduct entire afternoon shift
            totalMinutes -= afternoonShiftMinutes;
        }

        // Ensure total doesn't go below 0
        totalMinutes = Math.max(0, totalMinutes);

        return {
            totalMinutes: totalMinutes,
            formatted: minutesToHMS(totalMinutes),
            hours: (totalMinutes / 60).toFixed(2)
        };
    } catch (error) {
        console.error('Error calculating hours:', error);
        return { totalMinutes: 0, formatted: '0m', hours: '0.00' };
    }
}

// ========================
// Storage Operations
// ========================
function saveDTRRecords() {
    localStorage.setItem('dtrRecords', JSON.stringify(dtrRecords));
}

function loadDTRRecords() {
    const saved = localStorage.getItem('dtrRecords');
    if (saved) {
        dtrRecords = JSON.parse(saved);
    }
}

// ========================
// Table Updates
// ========================
function updateDTRTable() {
    const tbody = document.getElementById('dtrTableBody');
    tbody.innerHTML = '';

    if (dtrRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999;">No records yet</td></tr>';
        return;
    }

    // Sort by date descending
    const sorted = [...dtrRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(record => {
        const row = createTableRow(record, 'manual');
        tbody.appendChild(row);
    });
}

function updateUploadedTable() {
    const tbody = document.getElementById('uploadedTableBody');
    tbody.innerHTML = '';  // Clear existing rows first

    const consolidated = consolidateRecordsByDate(uploadedRecords);

    if (consolidated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999;">No uploaded records yet</td></tr>';
        return;
    }

    const sorted = consolidated.sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(record => {
        // Recalculate hours and status for consolidated records
        record.hoursRendered = calculateHoursRendered(record.morningIn, record.morningOut, record.afternoonIn, record.afternoonOut, record.specialStatus);
        record.morningStatus = checkTardiness(record.morningIn, designatedTimes.morningIn);
        record.afternoonStatus = checkTardiness(record.afternoonIn, designatedTimes.afternoonIn);
        const row = createTableRow(record, 'uploaded');
        tbody.appendChild(row);
    });
}

function createTableRow(record, type) {
    const row = document.createElement('tr');
    
    const morningStatusBadge = getStatusBadge(record.morningStatus);
    const afternoonStatusBadge = getStatusBadge(record.afternoonStatus);
    const hoursText = record.hoursRendered.formatted || '0m';

    // Handle WFH/Travel records with merged columns
    if (record.specialStatus === 'WFH' || record.specialStatus === 'TRAVEL') {
        const badgeClass = record.specialStatus === 'WFH' ? 'badge-wfh' : 'badge-travel';
        const badgeText = record.specialStatus === 'WFH' ? '🏠 Work From Home' : '✈️ Travel';
        row.innerHTML = `
            <td>${formatDate(record.date)}</td>
            <td>${record.employeeName}</td>
            <td colspan="4" style="text-align: center;"><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            <td colspan="2" style="text-align: center;"><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            <td><strong>${hoursText}</strong></td>
            <td>
                ${type === 'manual' ? `<button class="btn btn-danger" onclick="deleteDTRRecord(${record.id})" style="padding: 5px 10px; font-size: 0.85em;">Delete</button>` : ''}
            </td>
        `;
    } else {
        row.innerHTML = `
            <td>${formatDate(record.date)}</td>
            <td>${record.employeeName}</td>
            <td>${record.morningIn || '-'}</td>
            <td>${record.morningOut || '-'}</td>
            <td>${record.afternoonIn || '-'}</td>
            <td>${record.afternoonOut || '-'}</td>
            <td>${morningStatusBadge}</td>
            <td>${afternoonStatusBadge}</td>
            <td><strong>${hoursText}</strong></td>
            <td>
                ${type === 'manual' ? `<button class="btn btn-danger" onclick="deleteDTRRecord(${record.id})" style="padding: 5px 10px; font-size: 0.85em;">Delete</button>` : ''}
            </td>
        `;
    }

    return row;
}

function getStatusBadge(status) {
    if (status.status === 'on-time') {
        return '<span class="status-badge badge-on-time">✓ On Time</span>';
    } else if (status.status === 'late') {
        return `<span class="status-badge badge-late">⚠ ${status.label}</span>`;
    } else {
        return '<span class="status-badge badge-late">✗ Absent</span>';
    }
}

function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', options);
}

// ========================
// Summary & Statistics
// ========================
function consolidateRecordsByDate(records) {
    const consolidated = {};
    records.forEach(record => {
        // WFH/Travel records should stay separate (not consolidated with regular time records)
        const specialKey = record.specialStatus ? `|${record.specialStatus}` : '';
        const key = `${record.date}|${record.employeeName}${specialKey}`;
        
        if (!consolidated[key]) {
            consolidated[key] = { ...record };
        } else {
            const existing = consolidated[key];
            // Only merge regular time records (not WFH/Travel)
            if (!record.specialStatus) {
                if (!existing.morningIn && record.morningIn) existing.morningIn = record.morningIn;
                if (!existing.morningOut && record.morningOut) existing.morningOut = record.morningOut;
                if (!existing.afternoonIn && record.afternoonIn) existing.afternoonIn = record.afternoonIn;
                if (!existing.afternoonOut && record.afternoonOut) existing.afternoonOut = record.afternoonOut;
            }
        }
    });
    return Object.values(consolidated);
}

function updateSummary() {
    const allRecords = consolidateRecordsByDate([...dtrRecords, ...uploadedRecords]);

    if (allRecords.length === 0) {
        document.getElementById('totalRecords').textContent = '0';
        document.getElementById('onTimeCount').textContent = '0';
        document.getElementById('lateCount').textContent = '0';
        document.getElementById('totalHours').textContent = '0h';
        return;
    }

    let totalHours = 0;
    let onTime = 0;
    let late = 0;

    allRecords.forEach(record => {
        // Recalculate hours for consolidated records
        const hoursRendered = calculateHoursRendered(record.morningIn, record.morningOut, record.afternoonIn, record.afternoonOut, record.specialStatus);

        // Count tardiness (both morning and afternoon)
        const morningStatus = checkTardiness(record.morningIn, designatedTimes.morningIn);
        const afternoonStatus = checkTardiness(record.afternoonIn, designatedTimes.afternoonIn);

        if (morningStatus.status === 'on-time') onTime++;
        else if (morningStatus.status === 'late') late++;

        if (afternoonStatus.status === 'on-time') onTime++;
        else if (afternoonStatus.status === 'late') late++;

        // Sum hours
        if (hoursRendered && hoursRendered.totalMinutes) {
            totalHours += hoursRendered.totalMinutes;
        }
    });

    document.getElementById('totalRecords').textContent = allRecords.length;
    document.getElementById('onTimeCount').textContent = onTime;
    document.getElementById('lateCount').textContent = late;
    
    // Convert total hours to days/hours/mins format
    const totalDays = Math.floor(totalHours / (8 * 60)); // 8 hours = 1 work day
    const remainingHours = Math.floor((totalHours % (8 * 60)) / 60);
    const remainingMins = totalHours % 60;
    
    let totalHoursDisplay = [];
    if (totalDays > 0) totalHoursDisplay.push(`${totalDays}d`);
    if (remainingHours > 0) totalHoursDisplay.push(`${remainingHours}h`);
    if (remainingMins > 0) totalHoursDisplay.push(`${remainingMins}m`);
    
    document.getElementById('totalHours').textContent = totalHoursDisplay.length > 0 ? totalHoursDisplay.join(' ') : '0h';
}

// ========================
// Export Functions
// ========================
function exportToExcel() {
    const allRecords = consolidateRecordsByDate([...dtrRecords, ...uploadedRecords]);

    if (allRecords.length === 0) {
        showAlert('No data to export', 'error');
        return;
    }

    // Prepare data
    const data = allRecords.map(record => ({
        'Date': formatDate(record.date),
        'Employee': record.employeeName,
        'Morning In': record.morningIn || '-',
        'Morning Out': record.morningOut || '-',
        'Afternoon In': record.afternoonIn || '-',
        'Afternoon Out': record.afternoonOut || '-',
        'Morning Status': record.morningStatus?.label || 'Absent',
        'Afternoon Status': record.afternoonStatus?.label || 'Absent',
        'Hours Rendered': record.hoursRendered?.formatted || '0m'
    }));

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DTR Records");

    // Set column widths
    const colWidths = [
        { wch: 12 }, // Date
        { wch: 20 }, // Employee
        { wch: 12 }, // Morning In
        { wch: 12 }, // Morning Out
        { wch: 12 }, // Afternoon In
        { wch: 12 }, // Afternoon Out
        { wch: 15 }, // Morning Status
        { wch: 15 }, // Afternoon Status
        { wch: 15 }  // Hours Rendered
    ];
    ws['!cols'] = colWidths;

    // Download
    const fileName = `DTR_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showAlert('Excel file exported successfully!', 'success');
}

function generatePDF() {
    const allRecords = consolidateRecordsByDate([...dtrRecords, ...uploadedRecords]);

    if (allRecords.length === 0) {
        showAlert('No data to generate PDF', 'error');
        return;
    }

    const element = document.createElement('div');
    element.style.padding = '20px';
    element.innerHTML = `
        <h1>Daily Time Record Report</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
        <table border="1" cellpadding="10" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #667eea; color: white;">
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Morning In</th>
                    <th>Morning Out</th>
                    <th>Afternoon In</th>
                    <th>Afternoon Out</th>
                    <th>Morning Status</th>
                    <th>Afternoon Status</th>
                    <th>Hours Rendered</th>
                </tr>
            </thead>
            <tbody>
                ${allRecords.map(record => `
                    <tr>
                        <td>${formatDate(record.date)}</td>
                        <td>${record.employeeName}</td>
                        <td>${record.morningIn || '-'}</td>
                        <td>${record.morningOut || '-'}</td>
                        <td>${record.afternoonIn || '-'}</td>
                        <td>${record.afternoonOut || '-'}</td>
                        <td>${record.morningStatus?.label || 'Absent'}</td>
                        <td>${record.afternoonStatus?.label || 'Absent'}</td>
                        <td>${record.hoursRendered?.formatted || '0m'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    const opt = {
        margin: 10,
        filename: `DTR_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' }
    };

    html2pdf().set(opt).from(element).save();
    showAlert('PDF report generated successfully!', 'success');
}

// ========================
// File Upload & Parsing
// ========================
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileStatus = document.getElementById('fileStatus');
    fileStatus.style.display = 'block';
    fileStatus.className = 'alert alert-info';
    fileStatus.textContent = 'File selected: ' + file.name;
}

function parsePDFFile() {
    const fileInput = document.getElementById('pdfUpload');
    const file = fileInput.files[0];

    if (!file) {
        showAlert('Please select a file first', 'error');
        return;
    }

    const fileName = file.name.toLowerCase();
    const fileStatus = document.getElementById('fileStatus');
    fileStatus.style.display = 'block';

    if (fileName.endsWith('.pdf')) {
        parsePDF(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        parseExcel(file);
    } else if (fileName.endsWith('.csv')) {
        parseCSV(file);
    } else {
        showAlert('Unsupported file format', 'error');
    }
}

function parsePDF(file) {
    const fileStatus = document.getElementById('fileStatus');
    fileStatus.className = 'alert alert-info';
    fileStatus.textContent = 'Parsing PDF... This may take a moment.';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const pdf = pdfjsLib.getDocument(data);

            pdf.promise.then(function(pdfDoc) {
                const totalPages = pdfDoc.numPages;
                let extractedText = '';
                let pageProcessed = 0;

                const processPage = (pageNum) => {
                    if (pageNum > totalPages) {
                        // All pages processed
                        console.log('Extracted text length:', extractedText.length);
                        console.log('Extracted text preview:', extractedText.substring(0, 500));
                        parseDTRText(extractedText);
                        return;
                    }

                    pdfDoc.getPage(pageNum).then(function(page) {
                        return page.getTextContent();
                    }).then(function(textContent) {
                        // Extract text with better spacing
                        extractedText += textContent.items.map(item => item.str).join(' ') + '\n';
                        pageProcessed++;
                        
                        // Log progress
                        fileStatus.textContent = `Processing page ${pageProcessed} of ${totalPages}...`;
                        
                        // Process next page
                        processPage(pageNum + 1);
                    });
                };

                // Start processing pages
                processPage(1);
            }).catch(function(error) {
                fileStatus.className = 'alert alert-error';
                fileStatus.textContent = 'Error parsing PDF: ' + error.message;
                console.error('PDF parsing error:', error);
            });
        } catch (error) {
            fileStatus.className = 'alert alert-error';
            fileStatus.textContent = 'Error reading PDF file: ' + error.message;
            console.error('File read error:', error);
        }
    };
    reader.onerror = function() {
        fileStatus.className = 'alert alert-error';
        fileStatus.textContent = 'Error reading file. Please try again.';
    };
    reader.readAsArrayBuffer(file);
}

function parseExcel(file) {
    const fileStatus = document.getElementById('fileStatus');
    fileStatus.className = 'alert alert-info';
    fileStatus.textContent = 'Parsing Excel file... Please wait.';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const consolidated = consolidateRecordsByDate(jsonData.map((row, index) => {
                const dateCol = Object.keys(row).find(k => k.toLowerCase().includes('date'));
                const nameCol = Object.keys(row).find(k => k.toLowerCase().includes('employee') || k.toLowerCase().includes('name'));
                const miCol = Object.keys(row).find(k => k.toLowerCase().includes('morning') && k.toLowerCase().includes('in'));
                const moCol = Object.keys(row).find(k => k.toLowerCase().includes('morning') && k.toLowerCase().includes('out'));
                const aiCol = Object.keys(row).find(k => k.toLowerCase().includes('afternoon') && k.toLowerCase().includes('in'));
                const aoCol = Object.keys(row).find(k => k.toLowerCase().includes('afternoon') && k.toLowerCase().includes('out'));
                return {
                    id: Date.now() + index,
                    date: formatDateForStorage(row[dateCol]),
                    employeeName: row[nameCol],
                    morningIn: parseTime(row[miCol]),
                    morningOut: parseTime(row[moCol]),
                    afternoonIn: parseTime(row[aiCol]),
                    afternoonOut: parseTime(row[aoCol])
                };
            }));
            uploadedRecords = consolidated.map(record => {
                record.morningStatus = checkTardiness(record.morningIn, designatedTimes.morningIn);
                record.afternoonStatus = checkTardiness(record.afternoonIn, designatedTimes.afternoonIn);
                record.hoursRendered = calculateHoursRendered(record.morningIn, record.morningOut, record.afternoonIn, record.afternoonOut, record.specialStatus);
                return record;
            });
            updateUploadedTable();
            updateSummary();
            fileStatus.className = 'alert alert-success';
            fileStatus.textContent = `Successfully parsed ${consolidated.length} records from Excel file`;
        } catch (error) {
            fileStatus.className = 'alert alert-error';
            fileStatus.textContent = 'Error parsing Excel: ' + error.message;
        }
    };
    reader.readAsArrayBuffer(file);
}

function parseCSV(file) {
    const fileStatus = document.getElementById('fileStatus');
    fileStatus.className = 'alert alert-info';
    fileStatus.textContent = 'Parsing CSV file... Please wait.';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csv = e.target.result;
            const workbook = XLSX.read(csv, { type: 'string' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const consolidated = consolidateRecordsByDate(jsonData.map((row, index) => {
                const dateCol = Object.keys(row).find(k => k.toLowerCase().includes('date'));
                const nameCol = Object.keys(row).find(k => k.toLowerCase().includes('employee') || k.toLowerCase().includes('name'));
                const miCol = Object.keys(row).find(k => k.toLowerCase().includes('morning') && k.toLowerCase().includes('in'));
                const moCol = Object.keys(row).find(k => k.toLowerCase().includes('morning') && k.toLowerCase().includes('out'));
                const aiCol = Object.keys(row).find(k => k.toLowerCase().includes('afternoon') && k.toLowerCase().includes('in'));
                const aoCol = Object.keys(row).find(k => k.toLowerCase().includes('afternoon') && k.toLowerCase().includes('out'));
                return {
                    id: Date.now() + index,
                    date: formatDateForStorage(row[dateCol]),
                    employeeName: row[nameCol],
                    morningIn: parseTime(row[miCol]),
                    morningOut: parseTime(row[moCol]),
                    afternoonIn: parseTime(row[aiCol]),
                    afternoonOut: parseTime(row[aoCol])
                };
            }));
            uploadedRecords = consolidated.map(record => {
                record.morningStatus = checkTardiness(record.morningIn, designatedTimes.morningIn);
                record.afternoonStatus = checkTardiness(record.afternoonIn, designatedTimes.afternoonIn);
                record.hoursRendered = calculateHoursRendered(record.morningIn, record.morningOut, record.afternoonIn, record.afternoonOut, record.specialStatus);
                return record;
            });
            updateUploadedTable();
            updateSummary();
            fileStatus.className = 'alert alert-success';
            fileStatus.textContent = `Successfully parsed ${consolidated.length} records from CSV file`;
        } catch (error) {
            fileStatus.className = 'alert alert-error';
            fileStatus.textContent = 'Error parsing CSV: ' + error.message;
        }
    };
    reader.readAsText(file);
}

function parseDTRText(text) {
    const records = [];
    
    // Extract employee name
    let employeeName = 'Unknown Employee';
    const namePatterns = [
        /Mary\s+Llourane\s+Faith[^A-Z]*/i,
        /(?:Name\s*:?\s*)([A-Z][a-z]+\s+[A-Z][a-z]+[^\n]*)/i,
        /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/m
    ];
    
    for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match) {
            employeeName = match[0].replace(/n\/a/i, '').replace(/Jornadal/i, '').trim();
            if (employeeName.length > 2 && employeeName.length < 100) {
                break;
            }
        }
    }
    
    // Extract month/year
    let month = 'April';
    let year = new Date().getFullYear();
    const monthYearMatch = text.match(/For the month of\s+([A-Za-z]+),?\s+(\d{4})/i);
    if (monthYearMatch) {
        month = monthYearMatch[1];
        year = parseInt(monthYearMatch[2]);
    }
    
    // Month mapping
    const monthMap = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };
    const monthNum = monthMap[month.toLowerCase()] || '04';
    
    console.log('Parsed Info - Employee:', employeeName, 'Month:', month, 'Year:', year);
    
    // Clean up text - normalize whitespace for pattern matching
    let cleanText = text.replace(/\s+/g, ' ');
    
    // Pattern to match: day number, day name, followed by exactly 4 times in 12-hour format
    // Example: "16 Thu 07:27 AM 12:01 PM 12:30 PM 06:15 PM"
    // This pattern matches any number from 01-31, a day name, and 4 times
    const timeRecordPattern = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s+(\d{1,2}):(\d{2})\s*(AM|PM)/gi;
    
    let match;
    let recordCount = 0;
    
    while ((match = timeRecordPattern.exec(cleanText)) !== null) {
        try {
            const dayNum = match[1].padStart(2, '0');
            const dayName = match[2];
            
            // Parse the 4 times
            const times = [];
            
            // Time 1: indices 3,4,5 (hour, minute, AM/PM)
            let hour1 = parseInt(match[3]);
            const min1 = match[4];
            const period1 = match[5].toUpperCase();
            if (period1 === 'PM' && hour1 !== 12) hour1 += 12;
            if (period1 === 'AM' && hour1 === 12) hour1 = 0;
            times.push(`${String(hour1).padStart(2, '0')}:${min1}`);
            
            // Time 2: indices 6,7,8
            let hour2 = parseInt(match[6]);
            const min2 = match[7];
            const period2 = match[8].toUpperCase();
            if (period2 === 'PM' && hour2 !== 12) hour2 += 12;
            if (period2 === 'AM' && hour2 === 12) hour2 = 0;
            times.push(`${String(hour2).padStart(2, '0')}:${min2}`);
            
            // Time 3: indices 9,10,11
            let hour3 = parseInt(match[9]);
            const min3 = match[10];
            const period3 = match[11].toUpperCase();
            if (period3 === 'PM' && hour3 !== 12) hour3 += 12;
            if (period3 === 'AM' && hour3 === 12) hour3 = 0;
            times.push(`${String(hour3).padStart(2, '0')}:${min3}`);
            
            // Time 4: indices 12,13,14
            let hour4 = parseInt(match[12]);
            const min4 = match[13];
            const period4 = match[14].toUpperCase();
            if (period4 === 'PM' && hour4 !== 12) hour4 += 12;
            if (period4 === 'AM' && hour4 === 12) hour4 = 0;
            times.push(`${String(hour4).padStart(2, '0')}:${min4}`);
            
            const date = `${year}-${monthNum}-${dayNum}`;
            
            const record = {
                id: Date.now() + recordCount,
                date: date,
                employeeName: employeeName,
                morningIn: times[0],
                morningOut: times[1],
                afternoonIn: times[2],
                afternoonOut: times[3]
            };

            // Check for WFH/Travel in the original text immediately around this match (within same line/entry)
            const textAfterMatch = cleanText.substring(match.index + match[0].length, Math.min(cleanText.length, match.index + match[0].length + 50));
            const surroundingText = textAfterMatch.toUpperCase();
            
            // Only mark as WFH/Travel if the keyword appears immediately after the time entry (same line)
            const wfhMatch = surroundingText.match(/^(\s*)(WORK\s+FROM\s+HOME|WFH)/);
            const travelMatch = surroundingText.match(/^(\s*)(TRAVEL|FIELD\s+WORK)/);
            
            if (wfhMatch) {
                record.specialStatus = 'WFH';
            } else if (travelMatch) {
                record.specialStatus = 'TRAVEL';
            }

            // Calculate tardiness and hours
            record.morningStatus = checkTardiness(record.morningIn, designatedTimes.morningIn);
            record.afternoonStatus = checkTardiness(record.afternoonIn, designatedTimes.afternoonIn);
            record.hoursRendered = calculateHoursRendered(record.morningIn, record.morningOut, record.afternoonIn, record.afternoonOut, record.specialStatus);

            records.push(record);
            recordCount++;
            console.log(`Parsed record ${recordCount}:`, record);
        } catch (err) {
            console.error('Error parsing matched record:', err);
        }
    }

    // Pattern to detect standalone WFH/Travel entries (without times)
    // Format: "23 Fri Work From Home" or "24 Mon Travel"
    const wfhTravelPattern = /(\d{1,2})\s+([A-Za-z]{3})\s+(WORK\s+FROM\s+HOME|WFH|TRAVEL|FIELD\s+WORK)/gi;
    
    while ((match = wfhTravelPattern.exec(cleanText)) !== null) {
        try {
            const dayNum = match[1].padStart(2, '0');
            const statusText = match[3].toUpperCase();
            
            const date = `${year}-${monthNum}-${dayNum}`;
            
            const record = {
                id: Date.now() + recordCount,
                date: date,
                employeeName: employeeName,
                morningIn: '',
                morningOut: '',
                afternoonIn: '',
                afternoonOut: '',
                specialStatus: statusText.includes('WORK') || statusText.includes('WFH') ? 'WFH' : 'TRAVEL'
            };

            // Calculate hours (will be 8 hours for WFH/Travel)
            record.hoursRendered = calculateHoursRendered('', '', '', '', record.specialStatus);

            records.push(record);
            recordCount++;
            console.log(`Parsed WFH/Travel record ${recordCount}:`, record);
        } catch (err) {
            console.error('Error parsing WFH/Travel record:', err);
        }
    }

    console.log('Total records parsed:', records.length);
    
    const fileStatus = document.getElementById('fileStatus');
    
    if (records.length > 0) {
        uploadedRecords = consolidateRecordsByDate(records);
        updateUploadedTable();
        updateSummary();
        switchTab('uploaded-data');
        fileStatus.className = 'alert alert-success';
        fileStatus.textContent = `✓ Successfully parsed ${records.length} DTR records from PDF!`;
        showAlert(`Successfully parsed ${records.length} DTR records!`, 'success');
    } else {
        fileStatus.className = 'alert alert-warning';
        fileStatus.innerHTML = `
            <strong>Could not parse records.</strong> Debug Info:<br>
            • Extracted text length: ${text.length} characters<br>
            • Check browser console (F12) for detailed parsing information<br>
            • Ensure PDF has format: "Day DayName HH:MM AM/PM HH:MM AM/PM HH:MM AM/PM HH:MM AM/PM"<br>
            <br>
            <small>Example: "16 Thu 07:27 AM 12:01 PM 12:30 PM 06:15 PM"</small>
        `;
        showAlert('Could not parse any valid records. Check console for details.', 'warning');
    }
}

function processParsedDTRData(data) {
    const rawRecords = data.map((row, index) => {
        try {
            const dateCol = Object.keys(row).find(k => k.toLowerCase().includes('date'));
            const nameCol = Object.keys(row).find(k => k.toLowerCase().includes('employee') || k.toLowerCase().includes('name'));
            const miCol = Object.keys(row).find(k => k.toLowerCase().includes('morning') && k.toLowerCase().includes('in'));
            const moCol = Object.keys(row).find(k => k.toLowerCase().includes('morning') && k.toLowerCase().includes('out'));
            const aiCol = Object.keys(row).find(k => k.toLowerCase().includes('afternoon') && k.toLowerCase().includes('in'));
            const aoCol = Object.keys(row).find(k => k.toLowerCase().includes('afternoon') && k.toLowerCase().includes('out'));

            if (!dateCol || !nameCol) return null;

            return {
                id: Date.now() + index,
                date: formatDateForStorage(row[dateCol]),
                employeeName: row[nameCol],
                morningIn: parseTime(row[miCol]),
                morningOut: parseTime(row[moCol]),
                afternoonIn: parseTime(row[aiCol]),
                afternoonOut: parseTime(row[aoCol])
            };
        } catch (err) {
            console.error('Error processing row:', row, err);
            return null;
        }
    }).filter(r => r !== null);

    const consolidated = consolidateRecordsByDate(rawRecords);
    uploadedRecords = consolidated.map(record => {
        record.morningStatus = checkTardiness(record.morningIn, designatedTimes.morningIn);
        record.afternoonStatus = checkTardiness(record.afternoonIn, designatedTimes.afternoonIn);
        record.hoursRendered = calculateHoursRendered(record.morningIn, record.morningOut, record.afternoonIn, record.afternoonOut, record.specialStatus);
        return record;
    });

    updateUploadedTable();
    updateSummary();
}

function parseTime(timeStr) {
    if (!timeStr) return '';
    
    // Remove any whitespace and convert to string
    timeStr = String(timeStr).trim();
    
    // Check if it's already in HH:MM format (24-hour)
    if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
        return timeStr;
    }
    
    // Parse 12-hour AM/PM format: "07:27 AM" or "12:01 PM"
    const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (ampmMatch) {
        let hours = parseInt(ampmMatch[1]);
        const minutes = ampmMatch[2];
        const period = ampmMatch[3].toUpperCase();
        
        // Convert to 24-hour format
        if (period === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period === 'AM' && hours === 12) {
            hours = 0;
        }
        
        return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
    
    // Try to parse from 24-hour format without colon
    const match = timeStr.match(/(\d{1,2}):?(\d{2})/);
    if (match) {
        const hours = String(parseInt(match[1])).padStart(2, '0');
        const minutes = match[2];
        return `${hours}:${minutes}`;
    }
    
    return '';
}

function formatDateForStorage(dateStr) {
    if (!dateStr) return '';
    
    // If already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    
    // Try MM/DD/YYYY format
    const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
        const month = String(slashMatch[1]).padStart(2, '0');
        const day = String(slashMatch[2]).padStart(2, '0');
        const year = slashMatch[3];
        return `${year}-${month}-${day}`;
    }
    
    // Try DD-MM-YYYY format
    const dashMatch = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dashMatch) {
        const day = String(dashMatch[1]).padStart(2, '0');
        const month = String(dashMatch[2]).padStart(2, '0');
        const year = dashMatch[3];
        return `${year}-${month}-${day}`;
    }
    
    // Default: assume current month if just day number
    if (/^\d{1,2}$/.test(dateStr.trim())) {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        const day = String(parseInt(dateStr)).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    return '';
}

// ========================
// Tab Navigation
// ========================
function switchTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Remove active class from all buttons
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    document.getElementById(tabName).classList.add('active');

    // Add active class to clicked button
    event.target.classList.add('active');

    // Update tables when switching
    if (tabName === 'manual-entry') {
        updateDTRTable();
    } else if (tabName === 'uploaded-data') {
        updateUploadedTable();
    } else if (tabName === 'summary') {
        updateSummary();
    }
}

// ========================
// Utility Functions
// ========================
function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        alertDiv.style.transition = 'opacity 0.3s ease';
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
}

function closeModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

function clearAllData() {
    if (confirm('Are you sure you want to delete ALL DTR records? This cannot be undone.')) {
        dtrRecords = [];
        uploadedRecords = [];
        saveDTRRecords();
        updateDTRTable();
        updateUploadedTable();
        updateSummary();
        showAlert('All DTR records have been cleared', 'success');
    }
}

// ========================
// AJAX Simulation
// ========================
// Note: For production, replace these with actual backend API calls
function syncDataWithServer() {
    const allRecords = [...dtrRecords, ...uploadedRecords];
    
    // Simulate AJAX call
    console.log('Syncing data with server...');
    console.log('Records to sync:', allRecords);

    // Example fetch implementation (uncomment when ready):
    /*
    fetch('/api/dtr/sync', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            records: allRecords,
            settings: designatedTimes,
            timestamp: new Date().toISOString()
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Sync successful:', data);
        showAlert('Data synced with server', 'success');
    })
    .catch(error => {
        console.error('Sync error:', error);
        showAlert('Failed to sync with server', 'error');
    });
    */

    showAlert('Data sync functionality ready for backend integration', 'info');
}

// ========================
// Export for Integration
// ========================
window.DTRSystem = {
    addDTRRecord,
    deleteDTRRecord,
    exportToExcel,
    generatePDF,
    parsePDFFile,
    saveSettings,
    syncDataWithServer,
    getDTRRecords: () => dtrRecords,
    getDesignatedTimes: () => designatedTimes
};
