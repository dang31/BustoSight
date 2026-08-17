import { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import Sidebar from "../components/Sidebar";
import UserProfileBadge from "../components/UserProfileBadge";
import { supabase } from "../lib/supabase";
import "../css/Dashboard.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const BARANGAY_ORDER = [
  "Bonga Mayor",
  "Bonga Menor",
  "Buisan",
  "Camachilihan",
  "Cambaog",
  "Catacte",
  "Liciada",
  "Malamig",
  "Malawak",
  "Poblacion",
  "San Pedro",
  "Talampas",
  "Tanawan",
  "Tibagan",
];

const chartOpts = { responsive: true, maintainAspectRatio: false };
const barOpts = {
  ...chartOpts,
  indexAxis: "y",
  plugins: {
    legend: {
      display: true,
      position: "top",
      align: "end",
      labels: { boxWidth: 12, font: { size: 10 } },
    },
  },
  scales: {
    y: { ticks: { font: { size: 9 } }, grid: { display: false } },
    x: { ticks: { font: { size: 9 } }, grid: { display: false } },
  },
};



/**
 * Ordinary Least-Squares linear regression.
 *
 * @param {Array<{x: number, y: number}>} points – observed (year, count) pairs
 * @param {number} projectYears – how many years into the future to forecast
 * @returns {{ historicalLabels: string[], historicalData: number[],
 *             projectionLabels: string[], projectionData: number[],
 *             allLabels: string[], allData: number[],
 *             slope: number, intercept: number }}
 */
function linearRegression(points, projectYears = 6) {
  const empty = {
    historicalLabels: [],
    historicalData: [],
    actualData: [],
    projectionLabels: [],
    projectionData: [],
    allLabels: [],
    allData: [],
    slope: 0,
    intercept: 0,
  };

  if (!points || points.length === 0) return empty;

  // Sort by year ascending
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const N = sorted.length;
  const xs = sorted.map((p) => p.x);
  const ys = sorted.map((p) => p.y);

  let slope = 0;
  let intercept = ys[N - 1]; // fallback: flat line at latest value

  if (N >= 2) {
    const meanX = xs.reduce((s, v) => s + v, 0) / N;
    const meanY = ys.reduce((s, v) => s + v, 0) / N;
    let num = 0;
    let den = 0;
    for (let i = 0; i < N; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    slope = den === 0 ? 0 : num / den;
    intercept = meanY - slope * meanX;
  }

  const predict = (year) => Math.max(0, Math.round(slope * year + intercept));

  // Historical: use ACTUAL observed values, not fitted
  const historicalLabels = xs.map(String);
  const historicalData = ys; // real counts
  const actualData = ys; // alias for clarity

  // Future projection using the regression line
  const lastYear = xs[N - 1];
  const projectionLabels = [];
  const projectionData = [];
  for (let i = 1; i <= projectYears; i++) {
    const yr = lastYear + i;
    projectionLabels.push(String(yr));
    projectionData.push(predict(yr));
  }

  return {
    historicalLabels,
    historicalData,
    actualData,
    projectionLabels,
    projectionData,
    allLabels: [...historicalLabels, ...projectionLabels],
    allData: [...historicalData, ...projectionData],
    slope,
    intercept,
  };
}
export default function Dashboard() {
  const [modal, setModal] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [brgySearch, setBrgySearch] = useState("");
  const [brgySort, setBrgySort] = useState({ key: "name", direction: "asc" });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Derived stats
  const [stats, setStats] = useState({
    totalPopulation: 0,
    totalHouseholds: 0,
    totalSeniors: 0,
    totalVoters: 0,
    totalPwd: 0,
    totalSoloParent: 0,
    total4ps: 0,
    maleCount: 0,
    femaleCount: 0,
    lgbtCount: 0,
    childrenCount: 0,
    workingAgeCount: 0,
    seniorCount: 0,
    pwdWithId: 0,
    pwdNoId: 0,
    seniorWithId: 0,
    seniorNoId: 0,
    registeredVoters: 0,
    nonVoters: 0,
    teenPregnancyCases: 0,
    currentTeenMothers: 0,
    employed: 0,
    unemployed: 0,
  });

  const [brgyData, setBrgyData] = useState(
    BARANGAY_ORDER.map((name) => ({
      name,
      count: 0,
      seniors: 0,
      pwd: 0,
      households: 0,
      voters: 0,
      teenPreg: 0,
      teenMother: 0,
    })),
  );

  // Regression results — populated after data load
  const [popRegression, setPopRegression] = useState(null);
  const [seniorRegression, setSeniorRegression] = useState(null);
  const [voterRegression, setVoterRegression] = useState(null);
  const [teenPregRegression, setTeenPregRegression] = useState(null);
  const [employmentRegression, setEmploymentRegression] = useState(null);
  const [yearlyPopData, setYearlyPopData] = useState([]); // [{year, count}] for overview chart

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const targetYearArg = selectedYear === "all" ? null : Number(selectedYear);
        const { data, error } = await supabase.rpc('get_dashboard_stats', { target_year: targetYearArg });

        if (error) {
          throw error;
        }

        if (data) {
          let lgbtVal = data.global?.lgbtCount;
          if (lgbtVal === undefined) {
            try {
              let lgbtQuery = supabase
                .from("residents")
                .select("id", { count: "exact", head: true })
                .eq("is_archived", false)
                .ilike("sex", "%LGBT%");

              if (targetYearArg) {
                lgbtQuery = lgbtQuery.eq("data_year", targetYearArg);
              }

              const { count: lgbtCountResult } = await lgbtQuery;
              lgbtVal = lgbtCountResult || 0;
            } catch (lgbtErr) {
              console.error("Error fetching LGBT count fallback:", lgbtErr);
              lgbtVal = 0;
            }
          }

          // Fetch 4Ps count per barangay
          let fourPsPerBrgy = {};
          try {
            let query = supabase
              .from("residents")
              .select("barangay")
              .eq("is_archived", false)
              .eq("is_4ps", true);

            if (targetYearArg) {
              query = query.eq("data_year", targetYearArg);
            }

            const { data: fourPsData } = await query;
            if (fourPsData) {
              fourPsData.forEach((r) => {
                if (r.barangay) {
                  fourPsPerBrgy[r.barangay] = (fourPsPerBrgy[r.barangay] || 0) + 1;
                }
              });
            }
          } catch (fourPsErr) {
            console.error("Error fetching 4Ps per barangay:", fourPsErr);
          }

          const computedTotal4Ps = Object.values(fourPsPerBrgy).reduce((a, b) => a + b, 0);

          setStats({
            totalPopulation: data.global?.totalPopulation || 0,
            totalHouseholds: data.global?.totalHouseholds || 0,
            totalSeniors: data.global?.totalSeniors || 0,
            totalVoters: data.global?.registeredVoters || 0,
            totalPwd: data.global?.totalPwd || 0,
            totalSoloParent: data.global?.totalSoloParent || 0,
            total4ps: data.global?.total4ps || computedTotal4Ps || 0,
            maleCount: data.global?.maleCount || 0,
            femaleCount: data.global?.femaleCount || 0,
            lgbtCount: lgbtVal,
            childrenCount: data.global?.childrenCount || 0,
            workingAgeCount: data.global?.workingAgeCount || 0,
            seniorCount: data.global?.seniorCount || 0,
            pwdWithId: data.global?.pwdWithId || 0,
            pwdNoId: data.global?.pwdNoId || 0,
            seniorWithId: data.global?.seniorWithId || 0,
            seniorNoId: data.global?.seniorNoId || 0,
            registeredVoters: data.global?.registeredVoters || 0,
            nonVoters: data.global?.nonVoters || 0,
            teenPregnancyCases: data.global?.teenPregnancyCases || 0,
            currentTeenMothers: data.global?.currentTeenMothers || 0,
            employed: data.global?.employed || 0,
            unemployed: data.global?.unemployed || 0,
          });

          const brgyMap = {};
          if (Array.isArray(data.barangays)) {
            data.barangays.forEach(b => {
              brgyMap[b.name] = b;
            });
          }

          setBrgyData(
            BARANGAY_ORDER.map((name) => ({
              name,
              count: brgyMap[name]?.count || 0,
              seniors: brgyMap[name]?.seniors || 0,
              pwd: brgyMap[name]?.pwd || 0,
              households: brgyMap[name]?.households || 0,
              voters: brgyMap[name]?.voters || 0,
              fourPs: brgyMap[name]?.fourPs || brgyMap[name]?.four_ps || brgyMap[name]?.is4ps || brgyMap[name]?.is_4ps || brgyMap[name]?.total4ps || fourPsPerBrgy[name] || 0,
              teenPreg: brgyMap[name]?.teenPreg || 0,
              teenMother: brgyMap[name]?.teenMother || 0,
            })),
          );

          const yearlyPop = {};
          const yearlySenior = {};
          const yearlyVoter = {};
          const yearlyTeenPreg = {};
          const yearlyEmployed = {};

          if (data.yearly) {
            Object.entries(data.yearly).forEach(([yr, stats]) => {
              yearlyPop[yr] = stats.pop || 0;
              yearlySenior[yr] = stats.senior || 0;
              yearlyVoter[yr] = stats.voter || 0;
              yearlyTeenPreg[yr] = stats.teenPreg || 0;
              yearlyEmployed[yr] = stats.employed || 0;
            });
          }

          const toPoints = (obj) =>
            Object.entries(obj).map(([yr, cnt]) => ({ x: Number(yr), y: cnt }));

          setPopRegression(linearRegression(toPoints(yearlyPop)));
          setSeniorRegression(linearRegression(toPoints(yearlySenior)));
          setVoterRegression(linearRegression(toPoints(yearlyVoter)));
          setTeenPregRegression(linearRegression(toPoints(yearlyTeenPreg)));
          setEmploymentRegression(linearRegression(toPoints(yearlyEmployed)));

          setYearlyPopData(
            Object.entries(yearlyPop)
              .map(([yr, cnt]) => ({ year: Number(yr), count: cnt }))
              .sort((a, b) => a.year - b.year),
          );
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [selectedYear]);

  const handleSort = (key) => {
    setBrgySort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const filteredBrgyData = brgyData.filter((b) =>
    b.name.toLowerCase().includes(brgySearch.toLowerCase()),
  );

  const sortedBrgyData = [...filteredBrgyData].sort((a, b) => {
    let aVal = a[brgySort.key];
    let bVal = b[brgySort.key];

    if (typeof aVal === "string") {
      return brgySort.direction === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (aVal < bVal) return brgySort.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return brgySort.direction === "asc" ? 1 : -1;
    return 0;
  });

  const brgyTotals = filteredBrgyData.reduce(
    (acc, curr) => {
      acc.count += curr.count;
      acc.households += curr.households;
      acc.seniors += curr.seniors;
      acc.pwd += curr.pwd;
      acc.fourPs += curr.fourPs;
      acc.voters += curr.voters;
      return acc;
    },
    { count: 0, households: 0, seniors: 0, pwd: 0, fourPs: 0, voters: 0 },
  );

  // --- Derived chart data ---
  const barChartData = {
    labels: brgyData.map((b) => b.name),
    datasets: [
      {
        label: "Population",
        data: brgyData.map((b) => b.count),
        backgroundColor: "#5d87ff",
        barThickness: 10,
      },
    ],
  };

  const pieChartData = {
    labels: ["Male", "Female", "LGBTQ+"],
    datasets: [
      {
        data: [stats.maleCount, stats.femaleCount, stats.lgbtCount],
        backgroundColor: ["#5d87ff", "#ff85a2", "#a855f7"],
        borderWidth: 0,
      },
    ],
  };

  const ageChartData = {
    labels: ["Children (0-17)", "Working-Age (18-59)", "Seniors (60+)"],
    datasets: [
      {
        label: "Current",
        data: [stats.childrenCount, stats.workingAgeCount, stats.seniorCount],
        backgroundColor: "#5d87ff",
      },
    ],
  };

  // --- Build chart datasets from real regression results ---
  const emptyReg = {
    historicalLabels: [],
    historicalData: [],
    actualData: [],
    projectionLabels: [],
    projectionData: [],
    allLabels: [],
    allData: [],
    slope: 0,
    intercept: 0,
  };
  const pop = popRegression || emptyReg;
  const sen = seniorRegression || emptyReg;
  const vot = voterRegression || emptyReg;
  const tpg = teenPregRegression || emptyReg;
  const emp = employmentRegression || emptyReg;

  const projected5yr =
    pop.projectionData[pop.projectionData.length - 1] || stats.totalPopulation;
  const projectedSeniors5yr =
    sen.projectionData[sen.projectionData.length - 1] || stats.seniorCount;

  /** Builds a Chart.js dataset that shows actual historical data + dashed regression projection. */
  const buildLineChartData = (reg, label, historicalColor, projectionColor) => {
    // Bridge: the projection line starts from the last actual data point
    const lastActual =
      reg.actualData.length > 0
        ? reg.actualData[reg.actualData.length - 1]
        : null;
    return {
      labels: reg.allLabels,
      datasets: [
        {
          label: `${label} (Actual)`,
          data: [
            ...reg.actualData,
            ...Array(reg.projectionLabels.length).fill(null),
          ],
          borderColor: historicalColor,
          backgroundColor: historicalColor
            .replace(")", ", 0.12)")
            .replace("rgb", "rgba"),
          pointBackgroundColor: historicalColor,
          pointRadius: 4,
          fill: false,
          tension: 0.05,
          spanGaps: false,
        },
        {
          label: `${label} (Projection)`,
          data: [
            ...Array(Math.max(0, reg.historicalLabels.length - 1)).fill(null),
            lastActual,
            ...reg.projectionData,
          ],
          borderColor: projectionColor,
          backgroundColor: projectionColor
            .replace(")", ", 0.08)")
            .replace("rgb", "rgba"),
          borderDash: [6, 3],
          pointBackgroundColor: projectionColor,
          pointRadius: 3,
          fill: true,
          tension: 0.05,
          spanGaps: false,
        },
      ],
    };
  };

  const lineChartData = buildLineChartData(
    pop,
    "Population",
    "rgb(93,135,255)",
    "rgb(255,77,77)",
  );
  const votersLineData = buildLineChartData(
    vot,
    "Registered Voters",
    "rgb(0,128,128)",
    "rgb(0,180,180)",
  );
  const teenPregLineData = buildLineChartData(
    tpg,
    "Teen Pregnancy Cases",
    "rgb(239,68,68)",
    "rgb(252,165,165)",
  );
  const employmentLineData = buildLineChartData(
    emp,
    "Employed Residents",
    "rgb(59,130,246)",
    "rgb(147,197,253)",
  );

  const STAT_CARDS = [
    {
      label: "Total Population",
      value: stats.totalPopulation.toLocaleString(),
    },
    {
      label: "Total Households",
      value: stats.totalHouseholds.toLocaleString(),
    },
    { label: "Senior Citizens", value: stats.totalSeniors.toLocaleString() },
    { label: "Registered Voters", value: stats.totalVoters.toLocaleString() },
    { label: "PWD", value: stats.totalPwd.toLocaleString() },
    { label: "4Ps Beneficiaries", value: stats.total4ps.toLocaleString() },
    { label: "Solo Parents", value: stats.totalSoloParent.toLocaleString() },
  ];

  const FORECAST_CARDS = [
    {
      title: "Total Population Growth",
      body: [
        { label: "Current:", value: stats.totalPopulation.toLocaleString() },
        { label: "5-Year Projection:", value: projected5yr.toLocaleString() },
      ],
      tag: "↗ Linear Regression Projection",
      footer:
        "Analyzes the current database census metrics and projects growth using a fitted linear regression slope.",
    },
    {
      title: "Senior Population",
      body: [
        { label: "Ages 60+:", value: stats.seniorCount.toLocaleString() },
        {
          label: "Projected (5yr):",
          value: projectedSeniors5yr.toLocaleString(),
        },
      ],
      tag: "↗ Aging Linear Regression",
      footer:
        "Utilizes linear regression models on aging rates to project senior demographic counts in 5 years.",
    },
    {
      title: "Gender Breakdown",
      body: [
        { label: "Male:", value: stats.maleCount.toLocaleString() },
        { label: "Female:", value: stats.femaleCount.toLocaleString() },
        { label: "LGBTQ+:", value: stats.lgbtCount.toLocaleString() },
      ],
      footer:
        "Gender distribution of the current resident population from the uploaded demographic data.",
    },
    {
      title: "4Ps & Solo Parents",
      body: [
        { label: "4Ps Beneficiaries:", value: stats.total4ps.toLocaleString() },
        {
          label: "Solo Parents:",
          value: stats.totalSoloParent.toLocaleString(),
        },
      ],
      footer:
        "Counts of residents enrolled in the 4Ps program and registered solo parents across all barangays.",
    },
  ];

  const renderOverview = () => (
    <div className="tab-content animate-fade-up">
      {/* Stat Cards */}
      <div className="stats-container">
        {STAT_CARDS.map((card, i) => (
          <div
            key={i}
            className="stat-card"
            onClick={() => setModal({ category: card.label })}
            title={`View ${card.label} distribution`}
          >
            <h5>{card.label}</h5>
            <h2>{isLoading ? "…" : card.value}</h2>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-item">
          <h4>Gender Distribution</h4>
          <div className="chart-container pie-box">
            {!isLoading && <Pie data={pieChartData} options={chartOpts} />}
          </div>
        </div>

        <div className="chart-item">
          <h4>Population per Year</h4>
          <div className="chart-container">
            {!isLoading && yearlyPopData.length > 0 && (
              <Line
                data={{
                  labels: yearlyPopData.map((d) => String(d.year)),
                  datasets: [
                    {
                      label: "Population",
                      data: yearlyPopData.map((d) => d.count),
                      borderColor: "#5d87ff",
                      backgroundColor: "rgba(93,135,255,0.10)",
                      pointBackgroundColor: "#5d87ff",
                      pointRadius: 5,
                      fill: true,
                      tension: 0.2,
                    },
                  ],
                }}
                options={{
                  ...chartOpts,
                  plugins: { legend: { position: "top" } },
                  scales: {
                    y: { beginAtZero: true, grid: { color: "#edf2f7" } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            )}
            {!isLoading && yearlyPopData.length === 0 && (
              <p
                style={{
                  textAlign: "center",
                  color: "#718096",
                  padding: "30px",
                }}
              >
                No year data available.
              </p>
            )}
          </div>
          <p className="chart-note">
            Actual population count per data year from uploaded census records.
          </p>
        </div>
      </div>
    </div>
  );

  const renderBarangayAnalysis = () => {
    const headers = [
      { label: "Barangay", key: "name", align: "left", width: "18%" },
      { label: "Population", key: "count", align: "right", width: "13%" },
      { label: "Households", key: "households", align: "right", width: "13%" },
      { label: "Senior Citizens", key: "seniors", align: "right", width: "14%" },
      { label: "PWD", key: "pwd", align: "right", width: "13%" },
      { label: "4Ps Beneficiaries", key: "fourPs", align: "right", width: "15%" },
      { label: "Registered Voters", key: "voters", align: "right", width: "14%" },
    ];

    return (
      <div className="tab-content animate-fade-up">
        <div className="charts-grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="chart-item">
            <h4>Population by Barangay</h4>
            <div className="chart-container" style={{ height: "500px" }}>
              {!isLoading && (
                <Bar
                  data={barChartData}
                  options={{ ...barOpts, maintainAspectRatio: false }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Barangay breakdown table */}
        <div className="chart-item table-card" style={{ marginTop: "24px" }}>
          <div className="table-header-container">
            <h4 className="table-title">Barangay Summary Table</h4>
            <div className="table-search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search Barangay..."
                value={brgySearch}
                onChange={(e) => setBrgySearch(e.target.value)}
                className="table-search-input"
              />
              {brgySearch && (
                <button
                  className="clear-search-btn"
                  onClick={() => setBrgySearch("")}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="table-responsive-wrapper">
            <table className="custom-dashboard-table">
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h.key}
                      onClick={() => handleSort(h.key)}
                      style={{ textAlign: h.align, width: h.width }}
                      className={`sortable-header ${brgySort.key === h.key ? "active" : ""}`}
                    >
                      <span className="header-text">{h.label}</span>
                      <span className="sort-arrow">
                        {brgySort.key === h.key
                          ? brgySort.direction === "asc"
                            ? " ▲"
                            : " ▼"
                          : " ↕"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedBrgyData.length > 0 ? (
                  sortedBrgyData.map((b, i) => (
                    <tr key={b.name} className="table-row">
                      <td
                        className="cell-barangay"
                        style={{ textAlign: "left" }}
                      >
                        {b.name}
                      </td>
                      <td
                        className="cell-number"
                        style={{ textAlign: "right" }}
                      >
                        {b.count.toLocaleString()}
                      </td>
                      <td
                        className="cell-number"
                        style={{ textAlign: "right" }}
                      >
                        {b.households.toLocaleString()}
                      </td>
                      <td
                        className="cell-number"
                        style={{ textAlign: "right" }}
                      >
                        {b.seniors.toLocaleString()}
                      </td>
                      <td
                        className="cell-number"
                        style={{ textAlign: "right" }}
                      >
                        {b.pwd.toLocaleString()}
                      </td>
                      <td
                        className="cell-number"
                        style={{ textAlign: "right" }}
                      >
                        {b.fourPs.toLocaleString()}
                      </td>
                      <td
                        className="cell-number"
                        style={{ textAlign: "right" }}
                      >
                        {b.voters.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="no-data-cell">
                      No matching barangays found.
                    </td>
                  </tr>
                )}
              </tbody>
              {sortedBrgyData.length > 0 && (
                <tfoot>
                  <tr className="table-total-row">
                    <td
                      className="cell-barangay"
                      style={{ textAlign: "left", fontWeight: "bold" }}
                    >
                      Total
                    </td>
                    <td
                      className="cell-number"
                      style={{ textAlign: "right", fontWeight: "bold" }}
                    >
                      {brgyTotals.count.toLocaleString()}
                    </td>
                    <td
                      className="cell-number"
                      style={{ textAlign: "right", fontWeight: "bold" }}
                    >
                      {brgyTotals.households.toLocaleString()}
                    </td>
                    <td
                      className="cell-number"
                      style={{ textAlign: "right", fontWeight: "bold" }}
                    >
                      {brgyTotals.seniors.toLocaleString()}
                    </td>
                    <td
                      className="cell-number"
                      style={{ textAlign: "right", fontWeight: "bold" }}
                    >
                      {brgyTotals.pwd.toLocaleString()}
                    </td>
                    <td
                      className="cell-number"
                      style={{ textAlign: "right", fontWeight: "bold" }}
                    >
                      {brgyTotals.fourPs.toLocaleString()}
                    </td>
                    <td
                      className="cell-number"
                      style={{ textAlign: "right", fontWeight: "bold" }}
                    >
                      {brgyTotals.voters.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderDemographics = () => {
    // PWD
    const pwdPieData = {
      labels: ["Has PWD ID", "No ID"],
      datasets: [
        {
          data: [stats.pwdWithId, stats.pwdNoId],
          backgroundColor: ["#2e7d32", "#81c784"],
          borderWidth: 0,
        },
      ],
    };
    const pwdBarData = {
      labels: brgyData.map((b) => b.name),
      datasets: [
        {
          label: "PWD Count",
          data: brgyData.map((b) => b.pwd),
          backgroundColor: "#2e7d32",
        },
      ],
    };

    // Voters
    const voterPieData = {
      labels: ["Registered Voter", "Not Registered"],
      datasets: [
        {
          data: [stats.registeredVoters, stats.nonVoters],
          backgroundColor: ["#008080", "#e2e8f0"],
          borderWidth: 0,
        },
      ],
    };
    const voterBarData = {
      labels: brgyData.map((b) => b.name),
      datasets: [
        {
          label: "Registered Voters",
          data: brgyData.map((b) => b.voters),
          backgroundColor: "#008080",
        },
      ],
    };

    // Employment
    const employmentPieData = {
      labels: ["Employed", "Unemployed / Other"],
      datasets: [
        {
          data: [stats.employed, stats.unemployed],
          backgroundColor: ["#3b82f6", "#94a3b8"],
          borderWidth: 0,
        },
      ],
    };

    // Teenage Pregnancy
    const teenPregBarData = {
      labels: brgyData.map((b) => b.name),
      datasets: [
        {
          label: "Pregnancy Cases",
          data: brgyData.map((b) => b.teenPreg),
          backgroundColor: "#ef4444",
        },
        {
          label: "Current Teenage Mothers",
          data: brgyData.map((b) => b.teenMother),
          backgroundColor: "#fca5a5",
        },
      ],
    };

    // Senior Citizens
    const seniorPieData = {
      labels: ["Has Senior ID", "No ID"],
      datasets: [
        {
          data: [stats.seniorWithId, stats.seniorNoId],
          backgroundColor: ["#f59e0b", "#fcd34d"],
          borderWidth: 0,
        },
      ],
    };
    const seniorBarData = {
      labels: brgyData.map((b) => b.name),
      datasets: [
        {
          label: "Seniors Count",
          data: brgyData.map((b) => b.seniors),
          backgroundColor: "#f59e0b",
        },
      ],
    };

    // 4Ps Beneficiaries
    const fourPsPieData = {
      labels: ["4Ps Beneficiary", "Non-4Ps Resident"],
      datasets: [
        {
          data: [stats.total4ps, Math.max(0, stats.totalPopulation - stats.total4ps)],
          backgroundColor: ["#f59e0b", "#e2e8f0"],
          borderWidth: 0,
        },
      ],
    };
    const fourPsBarData = {
      labels: brgyData.map((b) => b.name),
      datasets: [
        {
          label: "4Ps Beneficiaries",
          data: brgyData.map((b) => b.fourPs),
          backgroundColor: "#f59e0b",
        },
      ],
    };

    return (
      <div className="tab-content animate-fade-up">
        {/* Row 1: Senior Citizens */}
        <div className="charts-grid">
          <div className="chart-item">
            <h4>Senior Citizen ID Status</h4>
            <div className="chart-container pie-box">
              {!isLoading && <Pie data={seniorPieData} options={chartOpts} />}
            </div>
          </div>
          <div className="chart-item">
            <h4>Seniors by Barangay</h4>
            <div className="chart-container">
              {!isLoading && <Bar data={seniorBarData} options={chartOpts} />}
            </div>
          </div>
        </div>

        {/* Row 2: PWD */}
        <div className="charts-grid" style={{ marginTop: "24px" }}>
          <div className="chart-item">
            <h4>PWD ID Card Status</h4>
            <div className="chart-container pie-box">
              {!isLoading && <Pie data={pwdPieData} options={chartOpts} />}
            </div>
          </div>
          <div className="chart-item">
            <h4>PWDs by Barangay</h4>
            <div className="chart-container">
              {!isLoading && <Bar data={pwdBarData} options={chartOpts} />}
            </div>
          </div>
        </div>

        {/* Row 3: 4Ps Beneficiaries */}
        <div className="charts-grid" style={{ marginTop: "24px" }}>
          <div className="chart-item">
            <h4>4Ps Beneficiaries Ratio</h4>
            <div className="chart-container pie-box">
              {!isLoading && <Pie data={fourPsPieData} options={chartOpts} />}
            </div>
            <div
              style={{
                marginTop: "12px",
                fontSize: "12px",
                color: "#64748b",
                textAlign: "center",
              }}
            >
              <span>
                <b>4Ps Enrolled:</b> {stats.total4ps.toLocaleString()} |{" "}
                <b>Non-4Ps:</b>{" "}
                {Math.max(0, stats.totalPopulation - stats.total4ps).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="chart-item">
            <h4>4Ps Beneficiaries by Barangay</h4>
            <div className="chart-container">
              {!isLoading && <Bar data={fourPsBarData} options={chartOpts} />}
            </div>
          </div>
        </div>

        {/* Row 4: Voters */}
        <div className="charts-grid" style={{ marginTop: "24px" }}>
          <div className="chart-item">
            <h4>Voter Registration Status</h4>
            <div className="chart-container pie-box">
              {!isLoading && <Pie data={voterPieData} options={chartOpts} />}
            </div>
          </div>
          <div className="chart-item">
            <h4>Registered Voters by Barangay</h4>
            <div className="chart-container">
              {!isLoading && <Bar data={voterBarData} options={chartOpts} />}
            </div>
          </div>
        </div>

        {/* Row 5: Employment & Pregnancy */}
        <div className="charts-grid" style={{ marginTop: "24px" }}>
          <div className="chart-item">
            <h4>Employment Status Breakdown</h4>
            <div className="chart-container pie-box">
              {!isLoading && (
                <Pie data={employmentPieData} options={chartOpts} />
              )}
            </div>
            <div
              style={{
                marginTop: "12px",
                fontSize: "12px",
                color: "#64748b",
                textAlign: "center",
              }}
            >
              <span>
                <b>Employed:</b> {stats.employed.toLocaleString()} |{" "}
                <b>Unemployed / Students / Other:</b>{" "}
                {stats.unemployed.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="chart-item">
            <h4>Teenage Pregnancy by Barangay</h4>
            <div className="chart-container">
              {!isLoading && <Bar data={teenPregBarData} options={chartOpts} />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderForecast = () => (
    <div className="tab-content animate-fade-up">
      <div className="forecast-container">
        {FORECAST_CARDS.map((fc, i) => (
          <div key={i} className="f-card">
            <div className="f-header">
              <strong>{fc.title}</strong>
            </div>
            <div className="f-body">
              {fc.body.map((row, j) => (
                <div key={j} className="f-val">
                  <span>{row.label}</span>
                  <strong>{isLoading ? "…" : row.value}</strong>
                </div>
              ))}
              {fc.tag && <div className="f-growth">{fc.tag}</div>}
              {fc.status && <div className="f-status">{fc.status}</div>}
            </div>
            <div className="f-footer">{fc.footer}</div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-item">
          <h4>Age Group Distribution</h4>
          <div className="chart-container">
            {!isLoading && <Bar data={ageChartData} options={chartOpts} />}
          </div>
          <p className="chart-note">
            Breakdown of current residents by age group: Children (0–17),
            Working-Age (18–59), Seniors (60+).
          </p>
        </div>

        <div className="chart-item">
          <h4>Growth Trends (Linear Regression)</h4>
          <div className="chart-container">
            {!isLoading && <Line data={lineChartData} options={chartOpts} />}
          </div>
        </div>
      </div>

      <div className="charts-grid" style={{ marginTop: "24px" }}>
        <div className="chart-item">
          <h4>Voters Prediction (Linear Regression)</h4>
          <div className="chart-container">
            {!isLoading && <Line data={votersLineData} options={chartOpts} />}
          </div>
          <p className="chart-note">
            Projected registered voter count for the next 5 years based on
            linear regression.
          </p>
        </div>

        <div className="chart-item">
          <h4>Employment Prediction (Linear Regression)</h4>
          <div className="chart-container">
            {!isLoading && (
              <Line data={employmentLineData} options={chartOpts} />
            )}
          </div>
          <p className="chart-note">
            Projected number of employed residents based on regression trends.
          </p>
        </div>
      </div>

      <div
        className="charts-grid"
        style={{ marginTop: "24px", gridTemplateColumns: "1fr" }}
      >
        <div className="chart-item">
          <h4>Teenage Pregnancy Prediction (Linear Regression)</h4>
          <div className="chart-container" style={{ height: "300px" }}>
            {!isLoading && <Line data={teenPregLineData} options={chartOpts} />}
          </div>
          <p className="chart-note">
            Estimated teenage pregnancy cases forecast using linear regression
            analysis.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />

      <Sidebar />

      <main className="content">
        <header className="main-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <h1>BustoSight: Population Dashboard</h1>
            {isLoading && (
              <span
                style={{ fontSize: "13px", color: "#718096", marginLeft: "12px" }}
              >
                Loading live data…
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div
              className="year-selector"
              ref={dropdownRef}
              style={{ position: 'relative', background: 'rgba(93,135,255,0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(93,135,255,0.2)', cursor: 'pointer', minWidth: '130px' }}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary-dark)', display: 'block', marginBottom: '2px', cursor: 'pointer', fontWeight: '700' }}>Data Year</label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--primary)', fontSize: '15px', fontWeight: 'bold' }}>{selectedYear === "all" ? "All Time" : selectedYear}</span>
                <i className={`fas fa-chevron-${isDropdownOpen ? 'up' : 'down'}`} style={{ color: 'var(--primary)', opacity: 0.7, fontSize: '12px', marginLeft: '10px' }}></i>
              </div>

              {isDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '8px',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  overflow: 'hidden',
                  zIndex: 1000,
                  border: '1px solid var(--gray-200)'
                }}>
                  {["all", ...Array.from(new Set([new Date().getFullYear(), ...yearlyPopData.map(d => d.year)])).sort((a, b) => b - a)].map(y => {
                    const displayValue = y === "all" ? "All Time" : String(y);
                    return (
                      <div
                        key={y}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedYear(String(y));
                          setIsDropdownOpen(false);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        style={{
                          padding: '10px 15px',
                          fontSize: '14px',
                          fontWeight: selectedYear === String(y) ? '700' : '500',
                          color: selectedYear === String(y) ? 'var(--primary)' : 'var(--gray-700)',
                          background: 'white',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        {displayValue}
                        {selectedYear === String(y) && <i className="fas fa-check" style={{ fontSize: '12px' }}></i>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <UserProfileBadge />
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="dashboard-tabs">
          <button
            className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === "barangay" ? "active" : ""}`}
            onClick={() => setActiveTab("barangay")}
          >
            Barangay Analysis
          </button>
          <button
            className={`tab-btn ${activeTab === "demographics" ? "active" : ""}`}
            onClick={() => setActiveTab("demographics")}
          >
            Demographics
          </button>
          <button
            className={`tab-btn ${activeTab === "forecast" ? "active" : ""}`}
            onClick={() => setActiveTab("forecast")}
          >
            Projections
          </button>
        </div>

        {activeTab === "overview" && renderOverview()}
        {activeTab === "barangay" && renderBarangayAnalysis()}
        {activeTab === "demographics" && renderDemographics()}
        {activeTab === "forecast" && renderForecast()}
      </main>

      {/* Distribution Modal */}
      {modal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="dist-modal-content">
            <div className="dist-header">
              <h3>{modal.category}</h3>
              <span className="close-dist" onClick={() => setModal(null)}>
                ×
              </span>
            </div>
            <div className="dist-list">
              {brgyData.map((item) => {
                let val = item.count;
                if (modal.category.toLowerCase().includes("household"))
                  val = item.households;
                else if (modal.category.toLowerCase().includes("senior"))
                  val = item.seniors;
                else if (modal.category.toLowerCase().includes("voter"))
                  val = item.voters;
                else if (modal.category.toLowerCase().includes("pwd"))
                  val = item.pwd;
                else if (modal.category.toLowerCase().includes("4p"))
                  val = item.fourPs;
                return (
                  <div key={item.name} className="dist-item">
                    <span>{item.name}</span>
                    <span>{val.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
