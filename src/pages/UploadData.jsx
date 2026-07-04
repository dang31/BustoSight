import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import '../css/UploadData.css';

const BARANGAYS = [
  'Bonga Mayor',
  'Poblacion',
  'San Pedro',
  'Talampas',
  'Tanawan',
  'Tibagan',
  'Bonga Menor',
  'Liciada',
  'Buisan',
  'Camachilihan',
  'Malamig',
  'Cambaog',
  'Catacte',
  'Malawak'
];

export default function UploadData() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const logContainerRef = useRef(null);

  const [file, setFile] = useState(null);
  const [workbookData, setWorkbookData] = useState(null);
  const [parsedSummary, setParsedSummary] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [totalRowsToUpload, setTotalRowsToUpload] = useState(0);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message, type }]);

    // Auto-scroll to bottom of log box
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processSelectedFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      processSelectedFile(selectedFile);
    }
  };

  // Safe converters
  const parseBool = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'boolean') return val;
    const str = String(val).toLowerCase().trim();
    return str === 'true' || str === 'yes' || str === '1' || str === 'y';
  };

  const parseDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      // SheetJS timezone adjustment
      return val.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    // Try matching YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymdMatch) {
      return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
    }
    // Try matching MM-DD-YYYY or M/D/YYYY
    const mdyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (mdyMatch) {
      return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
    }
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split('T')[0];
    }
    return null;
  };

  const parseIntOrNull = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? null : parsed;
  };

  const cleanString = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    return str === 'false' || str === 'FALSE' ? '' : str;
  };

  const processSelectedFile = (selectedFile) => {
    const fileExt = selectedFile.name.split('.').pop().toLowerCase();
    if (fileExt !== 'xlsx' && fileExt !== 'xls') {
      alert('Invalid file format. Please upload an Excel file (.xlsx or .xls).');
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);
    setParsedSummary([]);
    setUploadComplete(false);
    setUploadProgress(0);
    setLogs([]);
    addLog(`Loading file: ${selectedFile.name}...`, 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        // Load with cellDates to parse date format properly
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        setWorkbookData(workbook);

        addLog('File loaded successfully. Analyzing sheets...', 'success');

        let totalRows = 0;
        const summary = [];

        workbook.SheetNames.forEach((sheetName) => {
          // Case insensitive check for Barangay names
          const matchedBrgy = BARANGAYS.find(
            (b) => b.toLowerCase().replace(/\s/g, '') === sheetName.toLowerCase().replace(/\s/g, '')
          );

          if (!matchedBrgy) {
            addLog(`Sheet "${sheetName}" does not match any known Barangay. Skipping.`, 'info');
            return;
          }

          const worksheet = workbook.Sheets[sheetName];
          // Convert sheet to array of arrays to inspect and count rows
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

          if (rows.length <= 1) {
            summary.push({
              sheetName,
              barangayName: matchedBrgy,
              rowCount: 0,
              status: 'Empty Sheet'
            });
            addLog(`Barangay "${matchedBrgy}" sheet is empty.`, 'info');
            return;
          }

          // Headers are row 0. Data rows are rows from 1 onwards.
          const headers = rows[0].map(h => h ? String(h).trim() : '');

          // Verify we have relevant demographic fields
          const lastNameIdx = headers.findIndex(h => h.toLowerCase().includes('last name'));
          const firstNameIdx = headers.findIndex(h => h.toLowerCase().includes('first name'));

          if (lastNameIdx === -1 || firstNameIdx === -1) {
            summary.push({
              sheetName,
              barangayName: matchedBrgy,
              rowCount: 0,
              status: 'Missing Columns (Last Name/First Name)'
            });
            addLog(`Barangay "${matchedBrgy}" is missing critical columns.`, 'error');
            return;
          }

          // Count non-empty residents rows
          let validRowCount = 0;
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const lastName = row[lastNameIdx];
            const firstName = row[firstNameIdx];
            const hhNo = row[headers.findIndex(h => h.toLowerCase().includes('household no'))];

            if (cleanString(lastName) || cleanString(firstName) || cleanString(hhNo)) {
              validRowCount++;
            }
          }

          totalRows += validRowCount;
          summary.push({
            sheetName,
            barangayName: matchedBrgy,
            rowCount: validRowCount,
            status: 'Ready',
            rowsData: rows
          });

          addLog(`Barangay "${matchedBrgy}" is ready. Found ${validRowCount} resident records.`, 'success');
        });

        setParsedSummary(summary);
        setTotalRowsToUpload(totalRows);
        addLog(`Analysis complete. Found a total of ${totalRows} records in matches sheets. Click Upload to start.`, 'success');
      } catch (error) {
        console.error('Error parsing excel:', error);
        addLog(`Error parsing file: ${error.message}`, 'error');
        alert(`Failed to parse file: ${error.message}`);
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      addLog('Error reading file from disk.', 'error');
      setIsParsing(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const clearFile = () => {
    setFile(null);
    setWorkbookData(null);
    setParsedSummary([]);
    setUploadProgress(0);
    setLogs([]);
    setUploadComplete(false);
    setTotalRowsToUpload(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadToSupabase = async () => {
    if (parsedSummary.length === 0 || totalRowsToUpload === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    addLog('Starting import to Supabase database...', 'info');

    let totalUploaded = 0;
    const CHUNK_SIZE = 200;

    try {
      for (const item of parsedSummary) {
        if (item.rowCount === 0 || !item.rowsData) continue;

        addLog(`Processing Barangay ${item.barangayName}...`, 'info');
        const rows = item.rowsData;
        const headers = rows[0].map(h => h ? String(h).trim() : '');

        // Locate indexes for mapping
        const hhNoIdx = headers.findIndex(h => h.toLowerCase().includes('household no'));
        const houseNoIdx = headers.findIndex(h => h.toLowerCase().includes('house no'));
        const purokIdx = headers.findIndex(h => h.toLowerCase().includes('street/purok/sitio') || h.toLowerCase() === 'purok' || h.toLowerCase() === 'street');
        const resTypeIdx = headers.findIndex(h => h.toLowerCase().includes('residence type'));
        const isHeadIdx = headers.findIndex(h => h.toLowerCase().includes('is household head'));
        const relIdx = headers.findIndex(h => h.toLowerCase().includes('relationship to head') || h.toLowerCase().includes('relation to head'));
        const lastIdx = headers.findIndex(h => h.toLowerCase().includes('last name'));
        const firstIdx = headers.findIndex(h => h.toLowerCase().includes('first name'));
        const midIdx = headers.findIndex(h => h.toLowerCase().includes('middle name'));
        const qualIdx = headers.findIndex(h => h.toLowerCase().includes('name extension') || h.toLowerCase() === 'qualifier');
        const dobIdx = headers.findIndex(h => h.toLowerCase().includes('birth date'));
        const pobIdx = headers.findIndex(h => h.toLowerCase().includes('birth place') || h.toLowerCase().includes('place of birth'));
        const ageIdx = headers.findIndex(h => h.toLowerCase() === 'age');
        const sexIdx = headers.findIndex(h => h.toLowerCase() === 'sex');
        const civilIdx = headers.findIndex(h => h.toLowerCase().includes('civil status'));
        const religionIdx = headers.findIndex(h => h.toLowerCase() === 'religion');
        const citizenshipIdx = headers.findIndex(h => h.toLowerCase() === 'citizenship');
        const eduIdx = headers.findIndex(h => h.toLowerCase().includes('educational attainment') || h.toLowerCase().includes('education'));
        const occIdx = headers.findIndex(h => h.toLowerCase() === 'occupation');
        const pwdIdx = headers.findIndex(h => h.toLowerCase() === 'pwd');
        const hasPwdIdIdx = headers.findIndex(h => h.toLowerCase().includes('has pwd id'));
        const seniorIdx = headers.findIndex(h => h.toLowerCase().includes('senior citizen'));
        const hasSeniorIdIdx = headers.findIndex(h => h.toLowerCase().includes('has senior citizen id') || h.toLowerCase().includes('has senior id'));
        const soloIdx = headers.findIndex(h => h.toLowerCase().includes('solo parent'));
        const hasSoloIdx = headers.findIndex(h => h.toLowerCase().includes('has solo parent id') || h.toLowerCase().includes('has solo id'));
        const ageFirstBirthIdx = headers.findIndex(h => h.toLowerCase().includes('age at first birth'));
        const teenPregIdx = headers.findIndex(h => h.toLowerCase().includes('teenage pregnancy case') || h.toLowerCase().includes('teenage pregnancy'));
        const teenMotherIdx = headers.findIndex(h => h.toLowerCase().includes('current teenage mother'));
        const beneficiary4psIdx = headers.findIndex(h => h.toLowerCase().includes('4ps beneficiary') || h.toLowerCase().includes('4ps'));

        // Find Voter Information column. The spreadsheet has two columns of this name, the text one comes first.
        // We will grab the first occurrence in the headers array.
        const voterIdx = headers.indexOf('Voter Information');

        const residentsBatch = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;

          const lastVal = lastIdx !== -1 ? row[lastIdx] : null;
          const firstVal = firstIdx !== -1 ? row[firstIdx] : null;
          const hhNoVal = hhNoIdx !== -1 ? row[hhNoIdx] : null;

          // Skip if missing name or household no
          if (!cleanString(lastVal) && !cleanString(firstVal) && !cleanString(hhNoVal)) {
            continue;
          }

          // Build database object matching schema.
          const resident = {
            h_no: cleanString(hhNoVal) || 'N/A',
            house_no: houseNoIdx !== -1 ? cleanString(row[houseNoIdx]) : null,
            purok: purokIdx !== -1 ? cleanString(row[purokIdx]) : null,
            residence_type: resTypeIdx !== -1 ? cleanString(row[resTypeIdx]) : null,
            is_household_head: isHeadIdx !== -1 ? parseBool(row[isHeadIdx]) : false,
            relation_to_head: relIdx !== -1 ? cleanString(row[relIdx]) : null,
            last_name: cleanString(lastVal) || 'UNKNOWN',
            first_name: cleanString(firstVal) || 'UNKNOWN',
            middle_name: midIdx !== -1 ? cleanString(row[midIdx]) : null,
            qualifier: qualIdx !== -1 ? cleanString(row[qualIdx]) : null,
            birth_date: dobIdx !== -1 ? parseDate(row[dobIdx]) : null,
            birth_place: pobIdx !== -1 ? cleanString(row[pobIdx]) : null,
            age: ageIdx !== -1 ? parseIntOrNull(row[ageIdx]) : null,
            sex: sexIdx !== -1 ? cleanString(row[sexIdx]) : null,
            civil_status: civilIdx !== -1 ? cleanString(row[civilIdx]) : null,
            religion: religionIdx !== -1 ? cleanString(row[religionIdx]) : null,
            citizenship: citizenshipIdx !== -1 ? (cleanString(row[citizenshipIdx]) || 'FILIPINO') : 'FILIPINO',
            educational_attainment: eduIdx !== -1 ? cleanString(row[eduIdx]) : null,
            occupation: occIdx !== -1 ? cleanString(row[occIdx]) : null,
            is_pwd: pwdIdx !== -1 ? parseBool(row[pwdIdx]) : false,
            has_pwd_id: hasPwdIdIdx !== -1 ? parseBool(row[hasPwdIdIdx]) : false,
            is_senior: seniorIdx !== -1 ? parseBool(row[seniorIdx]) : false,
            has_senior_id: hasSeniorIdIdx !== -1 ? parseBool(row[hasSeniorIdIdx]) : false,
            is_solo_parent: soloIdx !== -1 ? parseBool(row[soloIdx]) : false,
            has_solo_parent_id: hasSoloIdx !== -1 ? parseBool(row[hasSoloIdx]) : false,
            age_at_first_birth: ageFirstBirthIdx !== -1 ? parseIntOrNull(row[ageFirstBirthIdx]) : null,
            teenage_pregnancy_case: teenPregIdx !== -1 ? parseBool(row[teenPregIdx]) : false,
            current_teenage_mother: teenMotherIdx !== -1 ? parseBool(row[teenMotherIdx]) : false,
            is_4ps: beneficiary4psIdx !== -1 ? parseBool(row[beneficiary4psIdx]) : false,
            is_voter: voterIdx !== -1 ? cleanString(row[voterIdx]) : null,
            barangay: item.barangayName,
            is_archived: false
          };

          residentsBatch.push(resident);
        }

        // Upload in chunks
        for (let j = 0; j < residentsBatch.length; j += CHUNK_SIZE) {
          const chunk = residentsBatch.slice(j, j + CHUNK_SIZE);
          addLog(`Uploading Barangay ${item.barangayName}: chunk ${Math.floor(j / CHUNK_SIZE) + 1} (${chunk.length} records)...`, 'info');

          const { error } = await supabase.from('residents').insert(chunk);
          if (error) {
            throw error;
          }

          totalUploaded += chunk.length;
          const progress = Math.min(Math.round((totalUploaded / totalRowsToUpload) * 100), 100);
          setUploadProgress(progress);
        }

        addLog(`Successfully uploaded ${residentsBatch.length} records for ${item.barangayName}.`, 'success');
      }

      addLog(`Database upload complete! Total successfully imported records: ${totalUploaded}.`, 'success');
      setUploadComplete(true);
      alert(`Import Successful! Added ${totalUploaded} residents to Supabase.`);
    } catch (err) {
      console.error('Error uploading to Supabase:', err);
      addLog(`CRITICAL ERROR during upload: ${err.message}`, 'error');
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="content">
        <div className="upload-card-container">
          <div className="upload-blue-header animate-fade-up">
            <h1>Excel Demographic Data Upload</h1>
            <p>Upload the voters demographic Excel file to populate the Supabase database. The sheet names in the workbook must match the barangay names.</p>
          </div>

          <div className="upload-white-body animate-fade-up">
            {/* File drop zone */}
            {!file ? (
              <div
                className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              >
                <div className="drop-zone-icon">⤓</div>
                <div className="drop-zone-text">
                  <h3>Drag & Drop Excel file here</h3>
                  <p>Or click to select from your device (.xlsx or .xls)</p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                />
                <button type="button" className="btn-select-file">
                  Browse Files
                </button>
              </div>
            ) : (
              <div className="file-info-box">
                <div className="file-info-left">
                  <div className="excel-icon">📄</div>
                  <div className="file-details">
                    <h4>{file.name}</h4>
                    <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-clear-file"
                  onClick={clearFile}
                  disabled={isUploading}
                >
                  Remove File
                </button>
              </div>
            )}

            {/* Parsing State */}
            {isParsing && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-600)' }}>
                <span className="loading-spinner">Parsing Excel sheets... Please wait.</span>
              </div>
            )}

            {/* Summary details */}
            {parsedSummary.length > 0 && (
              <div className="summary-container">
                <h3 className="summary-title">Spreadsheet Summary</h3>
                <div className="summary-grid">
                  {parsedSummary.map((item) => (
                    <div
                      key={item.sheetName}
                      className={`summary-card ${item.rowCount > 0 ? 'success-card' : 'empty-card'}`}
                    >
                      <div className="summary-brgy-name">{item.barangayName || item.sheetName}</div>
                      <div className="summary-brgy-count">{item.rowCount}</div>
                      <div className="summary-brgy-status">{item.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Logging and Progress */}
            {logs.length > 0 && (
              <div className="status-container">
                <div className="status-header">
                  <span className="status-title">
                    {isUploading ? 'Uploading records to Supabase...' : 'Log Activity'}
                  </span>
                  <span className="status-percentage">{uploadProgress}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="status-log" ref={logContainerRef}>
                  {logs.map((log, index) => (
                    <div key={index} className={`log-entry log-${log.type}`}>
                      <span>[{log.timestamp}] {log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="upload-buttons">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  if (window.confirm('Are you sure you want to go back?')) {
                    navigate('/barangay');
                  }
                }}
                disabled={isUploading}
              >
                Cancel
              </button>

              {uploadComplete ? (
                <button
                  type="button"
                  className="btn-upload-submit"
                  onClick={() => navigate('/barangay')}
                >
                  View Barangay List
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-upload-submit"
                  onClick={uploadToSupabase}
                  disabled={isUploading || parsedSummary.length === 0 || totalRowsToUpload === 0}
                >
                  {isUploading ? 'Uploading...' : `Upload ${totalRowsToUpload} Records`}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
