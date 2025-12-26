import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar 
} from 'recharts';

// ============================================================================
// INDIAN SPECIES DATABASE
// Data from: P-hydro (Joshi 2022), Plant-FATE (Joshi 2023), FSI, ICFRE
// ============================================================================
const SPECIES_DATABASE = {
  "Tectona grandis": { 
    common: "Teak", Hm: 35, rho: 550, k: 0.06, Dmax: 0.9, zeta: 0.21, bef: 1.46,
    category: "Plantation", rotation: 50 
  },
  "Eucalyptus tereticornis": { 
    common: "Eucalyptus", Hm: 45, rho: 640, k: 0.15, Dmax: 0.7, zeta: 0.17, bef: 1.31,
    category: "Plantation", rotation: 8 
  },
  "Populus deltoides": { 
    common: "Poplar", Hm: 30, rho: 380, k: 0.18, Dmax: 0.6, zeta: 0.20, bef: 1.35,
    category: "Agroforestry", rotation: 7 
  },
  "Dalbergia sissoo": { 
    common: "Shisham", Hm: 25, rho: 770, k: 0.07, Dmax: 0.8, zeta: 0.33, bef: 1.70,
    category: "Native", rotation: 40 
  },
  "Azadirachta indica": { 
    common: "Neem", Hm: 20, rho: 690, k: 0.08, Dmax: 0.6, zeta: 0.25, bef: 1.45,
    category: "Agroforestry", rotation: 30 
  },
  "Shorea robusta": { 
    common: "Sal", Hm: 35, rho: 720, k: 0.05, Dmax: 1.0, zeta: 0.27, bef: 1.30,
    category: "Native", rotation: 80 
  },
  "Acacia auriculiformis": { 
    common: "Acacia", Hm: 25, rho: 550, k: 0.13, Dmax: 0.5, zeta: 0.24, bef: 1.32,
    category: "Plantation", rotation: 12 
  },
  "Casuarina equisetifolia": { 
    common: "Casuarina", Hm: 25, rho: 830, k: 0.12, Dmax: 0.45, zeta: 0.22, bef: 1.25,
    category: "Plantation", rotation: 10 
  },
  "Mangifera indica": { 
    common: "Mango", Hm: 25, rho: 550, k: 0.07, Dmax: 0.8, zeta: 0.29, bef: 1.55,
    category: "Agroforestry", rotation: 50 
  },
  "Gmelina arborea": { 
    common: "Gamhar", Hm: 30, rho: 430, k: 0.12, Dmax: 0.7, zeta: 0.22, bef: 1.38,
    category: "Plantation", rotation: 15 
  },
  "Bambusa bambos": { 
    common: "Bamboo (Thorny)", Hm: 25, rho: 600, k: 0.30, Dmax: 0.15, zeta: 0.35, bef: 1.20,
    category: "Plantation", rotation: 5 
  },
  "Leucaena leucocephala": { 
    common: "Subabul", Hm: 15, rho: 520, k: 0.20, Dmax: 0.4, zeta: 0.30, bef: 1.35,
    category: "Agroforestry", rotation: 8 
  },
  "Pongamia pinnata": { 
    common: "Karanj", Hm: 18, rho: 620, k: 0.09, Dmax: 0.5, zeta: 0.26, bef: 1.42,
    category: "Agroforestry", rotation: 25 
  },
  "Albizia lebbeck": { 
    common: "Siris", Hm: 25, rho: 560, k: 0.10, Dmax: 0.6, zeta: 0.28, bef: 1.40,
    category: "Agroforestry", rotation: 20 
  },
  "Terminalia arjuna": { 
    common: "Arjun", Hm: 25, rho: 680, k: 0.08, Dmax: 0.7, zeta: 0.25, bef: 1.35,
    category: "Native", rotation: 30 
  },
  "Syzygium cumini": { 
    common: "Jamun", Hm: 25, rho: 680, k: 0.08, Dmax: 0.7, zeta: 0.24, bef: 1.38,
    category: "Agroforestry", rotation: 40 
  },
  "Tamarindus indica": { 
    common: "Tamarind", Hm: 25, rho: 880, k: 0.05, Dmax: 0.9, zeta: 0.28, bef: 1.50,
    category: "Agroforestry", rotation: 60 
  },
  "Moringa oleifera": { 
    common: "Moringa", Hm: 12, rho: 350, k: 0.25, Dmax: 0.35, zeta: 0.20, bef: 1.60,
    category: "Agroforestry", rotation: 10 
  },
};

// ============================================================================
// CARBON MODEL CALCULATIONS
// Based on T-model (Plant-FATE) + Chapman-Richards growth curves
// ============================================================================
const calculateProjection = (species, quantity, years = 40) => {
  const traits = SPECIES_DATABASE[species];
  if (!traits) return [];
  
  const results = [];
  const baseMortality = 0.02;
  const rhoRef = 600;
  const mortalityMod = Math.sqrt(rhoRef / traits.rho);
  const annualMortality = baseMortality * mortalityMod;
  const formFactor = 0.42;
  const carbonFraction = 0.47;
  
  for (let year = 1; year <= years; year++) {
    // Diameter: Chapman-Richards growth model
    const D = traits.Dmax * Math.pow(1 - Math.exp(-traits.k * year), 1.3);
    
    // Height: T-model from Plant-FATE (H = Hm * (1 - exp(-a*D/Hm)))
    const H = Math.max(1.3, traits.Hm * (1 - Math.exp(-50 * D / traits.Hm)));
    
    // Survival rate (exponential mortality with wood density effect)
    const survival = Math.max(0.1, Math.exp(-annualMortality * year));
    const survivingTrees = Math.floor(quantity * survival);
    
    // Volume-based biomass estimation
    const volume = (Math.PI / 4) * D * D * H * formFactor;
    const agbVolume = volume * traits.rho * traits.bef;
    
    // Chave et al. 2014 pantropical allometric equation
    const Dcm = D * 100;
    const agbChave = 0.0673 * Math.pow((traits.rho/1000) * Dcm * Dcm * H, 0.976);
    
    // Average of both methods for robustness
    const agbPerTree = (agbVolume + agbChave) / 2;
    const bgbPerTree = agbPerTree * traits.zeta;
    
    // Totals (convert kg to tonnes)
    const totalAgb = agbPerTree * survivingTrees / 1000;
    const totalBgb = bgbPerTree * survivingTrees / 1000;
    const totalCarbon = (totalAgb + totalBgb) * carbonFraction;
    const co2eq = totalCarbon * 3.67;  // C to CO2 conversion (44/12)
    
    results.push({
      year,
      dbh: parseFloat((D * 100).toFixed(1)),
      height: parseFloat(H.toFixed(1)),
      survival: parseFloat((survival * 100).toFixed(1)),
      survivingTrees,
      agbPerTree: parseFloat(agbPerTree.toFixed(1)),
      bgbPerTree: parseFloat(bgbPerTree.toFixed(1)),
      agb: parseFloat(totalAgb.toFixed(1)),
      bgb: parseFloat(totalBgb.toFixed(1)),
      biomass: parseFloat((totalAgb + totalBgb).toFixed(1)),
      carbon: parseFloat(totalCarbon.toFixed(1)),
      co2: parseFloat(co2eq.toFixed(1)),
    });
  }
  
  return results;
};

// Export data to CSV
const exportToCSV = (data, filename) => {
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).join(','));
  const csv = [headers, ...rows].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function App() {
  const [species, setSpecies] = useState("Tectona grandis");
  const [quantity, setQuantity] = useState(1000);
  const [years, setYears] = useState(40);
  const [view, setView] = useState('carbon');
  const [showComparison, setShowComparison] = useState(false);
  const [compareSpecies, setCompareSpecies] = useState([
    "Tectona grandis", 
    "Eucalyptus tereticornis", 
    "Populus deltoides"
  ]);
  
  const projection = useMemo(() => 
    calculateProjection(species, quantity, years),
    [species, quantity, years]
  );
  
  const comparisonData = useMemo(() => {
    if (!showComparison) return null;
    
    const allData = {};
    compareSpecies.forEach(sp => {
      const proj = calculateProjection(sp, quantity, years);
      proj.forEach(row => {
        if (!allData[row.year]) allData[row.year] = { year: row.year };
        allData[row.year][sp] = row.carbon;
      });
    });
    return Object.values(allData);
  }, [showComparison, compareSpecies, quantity, years]);
  
  const finalYear = projection[projection.length - 1];
  const traits = SPECIES_DATABASE[species];
  
  const colors = ['#16a34a', '#2563eb', '#dc2626', '#9333ea', '#f59e0b', '#06b6d4'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-green-800 text-white py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🌳 Carbon Stock Model
            </h1>
            <p className="text-green-200 text-sm">AGB + BGB Projections</p>
          </div>
          <div className="text-right text-sm">
            <div className="text-green-200">Based on T-model & P-hydro</div>
            <div className="text-green-300">18 Indian Species</div>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Input Controls */}
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Species</label>
              <select 
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {Object.entries(SPECIES_DATABASE)
                  .sort((a, b) => a[1].common.localeCompare(b[1].common))
                  .map(([sci, data]) => (
                    <option key={sci} value={sci}>
                      {data.common} ({sci}) - {data.category}
                    </option>
                  ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Trees</label>
              <input 
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                min="1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Years</label>
              <input 
                type="number"
                value={years}
                onChange={(e) => setYears(Math.min(100, Math.max(1, parseInt(e.target.value) || 40)))}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                min="1"
                max="100"
              />
            </div>
          </div>
          
          {/* Species Traits Panel */}
          {traits && (
            <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Max Height:</span>{' '}
                  <span className="font-semibold text-green-700">{traits.Hm}m</span>
                </div>
                <div>
                  <span className="text-gray-500">Wood Density (ρ):</span>{' '}
                  <span className="font-semibold text-green-700">{traits.rho} kg/m³</span>
                </div>
                <div>
                  <span className="text-gray-500">Growth Rate (k):</span>{' '}
                  <span className="font-semibold text-green-700">{traits.k}</span>
                </div>
                <div>
                  <span className="text-gray-500">Max DBH:</span>{' '}
                  <span className="font-semibold text-green-700">{(traits.Dmax * 100).toFixed(0)}cm</span>
                </div>
                <div>
                  <span className="text-gray-500">Root:Shoot (ζ):</span>{' '}
                  <span className="font-semibold text-green-700">{traits.zeta}</span>
                </div>
                <div>
                  <span className="text-gray-500">BEF:</span>{' '}
                  <span className="font-semibold text-green-700">{traits.bef}</span>
                </div>
                <div>
                  <span className="text-gray-500">Rotation:</span>{' '}
                  <span className="font-semibold text-green-700">{traits.rotation} yrs</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Summary Cards */}
        {finalYear && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white rounded-xl shadow p-4 text-center border-t-4 border-green-500">
              <div className="text-2xl md:text-3xl font-bold text-green-600">
                {finalYear.carbon.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">Tonnes Carbon</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center border-t-4 border-blue-500">
              <div className="text-2xl md:text-3xl font-bold text-blue-600">
                {finalYear.co2.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">Tonnes CO₂eq</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center border-t-4 border-amber-500">
              <div className="text-2xl md:text-3xl font-bold text-amber-600">
                {finalYear.biomass.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">Tonnes Biomass</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center border-t-4 border-emerald-500">
              <div className="text-2xl md:text-3xl font-bold text-emerald-600">
                {finalYear.survivingTrees.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">Surviving Trees</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center border-t-4 border-purple-500">
              <div className="text-2xl md:text-3xl font-bold text-purple-600">
                {(finalYear.carbon / years).toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 mt-1">t C/year avg</div>
            </div>
          </div>
        )}
        
        {/* Chart Controls */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'carbon', label: '🌿 Carbon', color: 'green' },
              { id: 'biomass', label: '🪵 Biomass', color: 'amber' },
              { id: 'growth', label: '📏 Growth', color: 'blue' },
              { id: 'co2', label: '💨 CO₂', color: 'cyan' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => { setView(v.id); setShowComparison(false); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  view === v.id && !showComparison
                    ? 'bg-green-600 text-white shadow' 
                    : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          
          <div className="border-l border-gray-300 h-6 mx-2 hidden md:block"></div>
          
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              showComparison
                ? 'bg-purple-600 text-white shadow' 
                : 'bg-white text-gray-700 hover:bg-purple-50 border border-gray-200'
            }`}
          >
            📊 Compare Species
          </button>
          
          <div className="flex-grow"></div>
          
          <button
            onClick={() => exportToCSV(projection, `carbon_projection_${species.replace(' ', '_')}.csv`)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 flex items-center gap-1"
          >
            📥 Export CSV
          </button>
        </div>
        
        {/* Comparison Species Selector */}
        {showComparison && (
          <div className="bg-purple-50 rounded-lg p-4 mb-4 border border-purple-100">
            <div className="text-sm font-medium text-purple-800 mb-2">Select species to compare:</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SPECIES_DATABASE).map(([sci, data]) => (
                <button
                  key={sci}
                  onClick={() => {
                    if (compareSpecies.includes(sci)) {
                      setCompareSpecies(compareSpecies.filter(s => s !== sci));
                    } else if (compareSpecies.length < 6) {
                      setCompareSpecies([...compareSpecies, sci]);
                    }
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    compareSpecies.includes(sci)
                      ? 'bg-purple-600 text-white' 
                      : 'bg-white text-gray-600 hover:bg-purple-100 border border-gray-200'
                  }`}
                >
                  {data.common}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Charts */}
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
          <ResponsiveContainer width="100%" height={350}>
            {showComparison && comparisonData ? (
              <LineChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} label={{ value: 'Carbon (t)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {compareSpecies.map((sp, i) => (
                  <Line 
                    key={sp}
                    type="monotone" 
                    dataKey={sp} 
                    stroke={colors[i % colors.length]} 
                    strokeWidth={2} 
                    name={SPECIES_DATABASE[sp].common}
                    dot={false}
                  />
                ))}
              </LineChart>
            ) : view === 'carbon' ? (
              <LineChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip formatter={(value) => [`${value} t`, '']} />
                <Legend />
                <Line type="monotone" dataKey="carbon" stroke="#16a34a" strokeWidth={2.5} name="Carbon (t C)" dot={false} />
              </LineChart>
            ) : view === 'biomass' ? (
              <AreaChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip formatter={(value) => [`${value} t`, '']} />
                <Legend />
                <Area type="monotone" dataKey="bgb" stackId="1" stroke="#8B4513" fill="#8B4513" name="BGB (t)" fillOpacity={0.8} />
                <Area type="monotone" dataKey="agb" stackId="1" stroke="#228B22" fill="#228B22" name="AGB (t)" fillOpacity={0.8} />
              </AreaChart>
            ) : view === 'growth' ? (
              <LineChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize: 11}} />
                <YAxis yAxisId="left" tick={{fontSize: 11}} label={{ value: 'DBH (cm)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 11}} label={{ value: 'Height (m)', angle: 90, position: 'insideRight', fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="dbh" stroke="#3b82f6" strokeWidth={2} name="DBH (cm)" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="height" stroke="#22c55e" strokeWidth={2} name="Height (m)" dot={false} />
              </LineChart>
            ) : (
              <AreaChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip formatter={(value) => [`${value} t CO₂`, '']} />
                <Legend />
                <Area type="monotone" dataKey="co2" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.3} name="CO₂ eq (t)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
        
        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Projection Data</h3>
            <span className="text-sm text-gray-500">{SPECIES_DATABASE[species].common}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-green-50 text-gray-700">
              <tr>
                <th className="p-2 text-left font-medium">Year</th>
                <th className="p-2 text-right font-medium">DBH</th>
                <th className="p-2 text-right font-medium">Height</th>
                <th className="p-2 text-right font-medium">Survival</th>
                <th className="p-2 text-right font-medium">Trees</th>
                <th className="p-2 text-right font-medium">AGB</th>
                <th className="p-2 text-right font-medium">BGB</th>
                <th className="p-2 text-right font-medium">Carbon</th>
                <th className="p-2 text-right font-medium">CO₂eq</th>
              </tr>
            </thead>
            <tbody>
              {projection
                .filter((_, i) => [0, 4, 9, 14, 19, 24, 29, 34, 39].includes(i) || i === projection.length - 1)
                .map((row) => (
                  <tr key={row.year} className="border-b hover:bg-green-50 transition">
                    <td className="p-2 font-medium">{row.year}</td>
                    <td className="p-2 text-right">{row.dbh} cm</td>
                    <td className="p-2 text-right">{row.height} m</td>
                    <td className="p-2 text-right">{row.survival}%</td>
                    <td className="p-2 text-right">{row.survivingTrees.toLocaleString()}</td>
                    <td className="p-2 text-right">{row.agb} t</td>
                    <td className="p-2 text-right">{row.bgb} t</td>
                    <td className="p-2 text-right font-semibold text-green-600">{row.carbon} t</td>
                    <td className="p-2 text-right font-semibold text-blue-600">{row.co2} t</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        
        {/* Model Info Footer */}
        <div className="mt-6 p-4 bg-white rounded-xl shadow text-sm text-gray-600">
          <h4 className="font-semibold text-gray-800 mb-2">Model Methodology</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="mb-1"><strong>Growth:</strong> Chapman-Richards: D(t) = Dmax × (1 - e^(-kt))^1.3</p>
              <p className="mb-1"><strong>Height:</strong> T-model: H = Hm × (1 - e^(-50D/Hm))</p>
              <p className="mb-1"><strong>Biomass:</strong> Average of volume-based + Chave et al. 2014</p>
            </div>
            <div>
              <p className="mb-1"><strong>BGB:</strong> Species-specific root:shoot ratios (ζ)</p>
              <p className="mb-1"><strong>Carbon:</strong> 47% of dry biomass (IPCC refined)</p>
              <p className="mb-1"><strong>CO₂:</strong> Carbon × 3.67 (molecular weight ratio)</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Sources: Plant-FATE (Joshi 2023), P-hydro (Joshi 2022), FSI Volume Equations, ICFRE Manual, Chave et al. 2014
          </p>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-green-800 text-green-200 py-4 px-6 mt-8">
        <div className="max-w-6xl mx-auto text-center text-sm">
          <p>Carbon Stock Assessment Model v1.0</p>
          <p className="text-green-400 text-xs mt-1">Open source under GPLv3 License</p>
        </div>
      </footer>
    </div>
  );
}
