// Data for Barangay Stats
export const brgyStats = [
  { name: "Bonga Mayor", hh: 345, senior: 45, voters: 890, pwd: 12, citizen: 1540 },
  { name: "Bonga Menor", hh: 290, senior: 38, voters: 750, pwd: 8, citizen: 1200 },
  { name: "Buisan", hh: 150, senior: 20, voters: 400, pwd: 5, citizen: 650 },
  { name: "Camachilihan", hh: 210, senior: 25, voters: 560, pwd: 7, citizen: 890 },
  { name: "Cambaog", hh: 420, senior: 55, voters: 1100, pwd: 15, citizen: 1850 },
  { name: "Catacte", hh: 180, senior: 22, voters: 480, pwd: 6, citizen: 780 },
  { name: "Liciada", hh: 510, senior: 70, voters: 1350, pwd: 20, citizen: 2200 },
  { name: "Malamig", hh: 230, senior: 30, voters: 610, pwd: 9, citizen: 1050 },
  { name: "Malawak", hh: 275, senior: 35, voters: 720, pwd: 11, citizen: 1180 },
  { name: "Poblacion", hh: 580, senior: 85, voters: 1600, pwd: 25, citizen: 2600 },
  { name: "San Pedro", hh: 195, senior: 28, voters: 520, pwd: 8, citizen: 880 },
  { name: "Talampas", hh: 310, senior: 42, voters: 830, pwd: 14, citizen: 1420 },
  { name: "Tanawan", hh: 260, senior: 32, voters: 680, pwd: 10, citizen: 1120 },
  { name: "Tibagan", hh: 330, senior: 48, voters: 900, pwd: 13, citizen: 1510 }
];

export const barangayNames = brgyStats.map(b => b.name).sort();
