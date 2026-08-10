import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Sidebar from '../components/Sidebar';
import UserProfileBadge from '../components/UserProfileBadge';
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

// Years selectable for tagging a batch of imported data.
// Adjust the start year as needed for older records you plan to migrate.
const START_YEAR = 2020;
const CURRENT_YEAR = new Date().getFullYear();
const DATA_YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - START_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i
);

// Canonical column definitions, used for BOTH scanning (to build the summary/
// validation) and uploading (to build each resident row). Keeping this in one
// place means a header typo or matching bug only ever needs fixing once, and
// scanning/upload can never silently disagree with each other.
//
// `required: true` columns MUST be found in the sheet's header row, or the
// whole sheet is rejected (excluded from upload) with a clear error listing
// exactly which column(s) couldn't be matched. This is what catches typos
// like "Voter Informatation" or corrupted headers like "Household FALSE"
// instead of silently importing null/N/A values.
const COLUMN_DEFS = [
  { key: 'hhNo', label: 'Household No.', required: true, match: h => h.includes('household') },
  { key: 'houseNo', label: 'House No.', required: false, match: h => h.includes('house') && !h.includes('household') },
  { key: 'purok', label: 'Street/Purok/Sitio', required: false, match: h => h.includes('street/purok/sitio') || h === 'purok' || h === 'street' },
  { key: 'resType', label: 'Residence Type', required: false, match: h => h.includes('residence type') },
  { key: 'isHead', label: 'Is Household Head', required: false, match: h => h.includes('is household head') },
  { key: 'rel', label: 'Relationship to Head', required: false, match: h => h.includes('relationship to head') || h.includes('relation to head') },
  { key: 'last', label: 'Last Name', required: true, match: h => h.includes('last name') },
  { key: 'first', label: 'First Name', required: true, match: h => h.includes('first name') },
  { key: 'mid', label: 'Middle Name', required: false, match: h => h.includes('middle name') },
  { key: 'qual', label: 'Name Extension/Qualifier', required: false, match: h => h.includes('name extension') || h === 'qualifier' },
  { key: 'dob', label: 'Birth Date', required: true, match: h => h.includes('birth date') },
  { key: 'pob', label: 'Birth Place', required: false, match: h => h.includes('birth place') || h.includes('place of birth') },
  { key: 'age', label: 'Age', required: false, match: h => h === 'age' },
  { key: 'sex', label: 'Sex', required: true, match: h => h === 'sex' },
  { key: 'civil', label: 'Civil Status', required: false, match: h => h.includes('civil status') },
  { key: 'religion', label: 'Religion', required: false, match: h => h === 'religion' },
  { key: 'citizenship', label: 'Citizenship', required: false, match: h => h === 'citizenship' },
  { key: 'edu', label: 'Educational Attainment', required: false, match: h => h.includes('educational attainment') || h.includes('education') },
  { key: 'occ', label: 'Occupation', required: false, match: h => h === 'occupation' },
  { key: 'voter', label: 'Voter Information', required: true, match: h => h.includes('voter') },
  { key: 'pwd', label: 'PWD', required: false, match: h => h === 'pwd' },
  { key: 'hasPwdId', label: 'Has PWD ID', required: false, match: h => h.includes('has pwd id') },
  { key: 'senior', label: 'Senior Citizen', required: false, match: h => h.includes('senior citizen') },
  { key: 'hasSeniorId', label: 'Has Senior Citizen ID', required: false, match: h => h.includes('has senior citizen id') || h.includes('has senior id') },
  { key: 'solo', label: 'Solo Parent', required: false, match: h => h.includes('solo parent') },
  { key: 'hasSoloId', label: 'Has Solo Parent ID', required: false, match: h => h.includes('has solo parent id') || h.includes('has solo id') },
  { key: 'ageFirstBirth', label: 'Age at First Birth', required: false, match: h => h.includes('age at first birth') },
  { key: 'teenPreg', label: 'Teenage Pregnancy Case', required: false, match: h => h.includes('teenage pregnancy case') || h.includes('teenage pregnancy') },
  { key: 'teenMother', label: 'Current Teenage Mother', required: false, match: h => h.includes('current teenage mother') },
  { key: 'beneficiary4ps', label: '4Ps Beneficiary', required: false, match: h => h.includes('4ps beneficiary') || h.includes('4ps') }
];

// Scans a sheet's header row against COLUMN_DEFS. Returns the column index
// for every field (indices), plus a list of required-column labels that
// could not be matched (missingRequired) - a non-empty list means the sheet
// should be rejected rather than silently uploaded with bad/missing data.
function analyzeHeaders(headers) {
  const lower = headers.map(h => (h || '').toLowerCase().trim());
  const indices = {};
  const missingRequired = [];

  COLUMN_DEFS.forEach((def) => {
    const idx = lower.findIndex(def.match);
    indices[def.key] = idx;
    if (def.required && idx === -1) {
      missingRequired.push(def.label);
    }
  });

  return { indices, missingRequired };
}

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
  const [dataYear, setDataYear] = useState('');

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

          // Validate ALL required columns are present against the canonical
          // definitions - catches typos (e.g. "Voter Informatation") and
          // corrupted/mislabeled headers (e.g. "Household FALSE") up front,
          // instead of silently importing null/N/A for those fields.
          const { indices, missingRequired } = analyzeHeaders(headers);

          if (missingRequired.length > 0) {
            summary.push({
              sheetName,
              barangayName: matchedBrgy,
              rowCount: 0,
              status: `Missing/Unrecognized Columns: ${missingRequired.join(', ')}`
            });
            addLog(
              `Barangay "${matchedBrgy}" is missing or has unrecognized column(s): ${missingRequired.join(', ')}. This sheet will NOT be uploaded until fixed.`,
              'error'
            );
            return;
          }

          const lastNameIdx = indices.last;
          const firstNameIdx = indices.first;
          const hhNoIdxForCount = indices.hhNo;

          // Count non-empty residents rows
          let validRowCount = 0;
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const lastName = row[lastNameIdx];
            const firstName = row[firstNameIdx];
            const hhNo = row[hhNoIdxForCount];

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
        addLog(`Analysis complete. Found a total of ${totalRows} records in matches sheets. Select the data year and click Upload to start.`, 'success');
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
    setDataYear('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadToSupabase = async () => {
    if (parsedSummary.length === 0 || totalRowsToUpload === 0) return;

    if (!dataYear) {
      alert('Please select the year this data belongs to before uploading.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    addLog(`Starting import to Supabase database for data year ${dataYear}...`, 'info');

    let totalUploaded = 0;
    const CHUNK_SIZE = 200;

    try {
      for (const item of parsedSummary) {
        if (item.rowCount === 0 || !item.rowsData) continue;

        addLog(`Processing Barangay ${item.barangayName}...`, 'info');
        const rows = item.rowsData;
        const headers = rows[0].map(h => h ? String(h).trim() : '');

        // Re-validate against the same canonical definitions used during
        // scanning. This is a safety net - the scanning step already excludes
        // sheets with missing required columns from parsedSummary, so this
        // should never trigger in practice, but it guarantees the upload can
        // never proceed with a header it can't confidently map.
        const { indices, missingRequired } = analyzeHeaders(headers);
        if (missingRequired.length > 0) {
          addLog(
            `ABORTED Barangay "${item.barangayName}": missing/unrecognized column(s): ${missingRequired.join(', ')}.`,
            'error'
          );
          throw new Error(
            `Barangay ${item.barangayName} has missing or unrecognized column(s): ${missingRequired.join(', ')}. Fix the spreadsheet headers and re-upload.`
          );
        }

        const {
          hhNo: hhNoIdx, houseNo: houseNoIdx, purok: purokIdx, resType: resTypeIdx,
          isHead: isHeadIdx, rel: relIdx, last: lastIdx, first: firstIdx, mid: midIdx,
          qual: qualIdx, dob: dobIdx, pob: pobIdx, age: ageIdx, sex: sexIdx,
          civil: civilIdx, religion: religionIdx, citizenship: citizenshipIdx,
          edu: eduIdx, occ: occIdx, voter: voterIdx, pwd: pwdIdx, hasPwdId: hasPwdIdIdx,
          senior: seniorIdx, hasSeniorId: hasSeniorIdIdx, solo: soloIdx,
          hasSoloId: hasSoloIdx, ageFirstBirth: ageFirstBirthIdx, teenPreg: teenPregIdx,
          teenMother: teenMotherIdx, beneficiary4ps: beneficiary4psIdx
        } = indices;

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
            is_archived: false,
            data_year: parseInt(dataYear, 10)
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

      addLog(`Database upload complete! Total successfully imported records: ${totalUploaded} (data year: ${dataYear}).`, 'success');
      setUploadComplete(true);
      alert(`Import Successful! Added ${totalUploaded} residents to Supabase for data year ${dataYear}.`);
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
        <header className="main-header">
          <h1>Demographic Data Import Portal</h1>
          <UserProfileBadge />
        </header>

        <div className="upload-card-container">
          <div className="upload-blue-header animate-fade-up">
            <h1 style={{ margin: 0, fontSize: "19px" }}>Excel Batch Upload Portal</h1>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", opacity: 0.9 }}>
              Upload demographic Excel workbooks (.xlsx / .xls) to populate database records. Workbook sheet names must correspond to official Bustos barangay names.
            </p>
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

            {/* Data year selector - required before upload */}
            {file && !isParsing && (
              <div className="data-year-select-box">
                <label htmlFor="dataYearSelect" className="data-year-label">
                  Data Year <span style={{ color: '#e53e3e' }}>*</span>
                  <span className="data-year-hint"> — which year does this batch of records belong to?</span>
                </label>
                <select
                  id="dataYearSelect"
                  className="data-year-select"
                  value={dataYear}
                  onChange={(e) => setDataYear(e.target.value)}
                  disabled={isUploading || uploadComplete}
                >
                  <option value="">-- Select Year --</option>
                  {DATA_YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
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
                  disabled={isUploading || parsedSummary.length === 0 || totalRowsToUpload === 0 || !dataYear}
                >
                  {isUploading
                    ? 'Uploading...'
                    : !dataYear
                      ? 'Select a Data Year to Continue'
                      : `Upload ${totalRowsToUpload} Records (${dataYear})`}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}