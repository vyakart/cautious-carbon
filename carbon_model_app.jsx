import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Indian Species Database (from P-hydro & Plant-FATE papers + Indian forestry research)
const SPECIES_DATABASE = {
  "Tectona grandis": { common: "Teak", Hm: 35, rho: 550, k: 0.06, Dmax: 0.9, zeta: 0.21, bef: 1.46 },
  "Eucalyptus tereticornis": { common: "Eucalyptus", Hm: 45, rho: 640, k: 0.15, Dmax: 0.7, zeta: 0.17, bef: 1.31 },
  "Populus deltoides": { common: "Poplar", Hm: 30, rho: 380, k: 0.18, Dmax: 0.6, zeta: 0.20, bef: 1.35 },
  "Dalbergia sissoo": { common: "Shisham", Hm: 25, rho: 770, k: 0.07, Dmax: 0.8, zeta: 0.33, bef: 1.70 },
  "Azadirachta indica": { common: "Neem", Hm: 20, rho: 690, k: 0.08, Dmax: 0.6, zeta: 0.25, bef: 1.45 },
  "Shorea robusta": { common: "Sal", Hm: 35, rho: 720, k: 0.05, Dmax: 1.0, zeta: 0.27, bef: 1.30 },
  "Acacia auriculiformis": { common: "Acacia", Hm: 25, rho: 550, k: 0.13, Dmax: 0.5, zeta: 0.24, bef: 1.32 },
  "Casuarina equisetifolia": { common: "Casuarina", Hm: 25, rho: 830, k: 0.12, Dmax: 0.45, zeta: 0.22, bef: 1.25 },
  "Mangifera indica": { common: "Mango", Hm: 25, rho: 550, k: 0.07, Dmax: 0.8, zeta: 0.29, bef: 1.55 },
  "Gmelina arborea": { common: "Gamhar", Hm: 30, rho: 430, k: 0.12, Dmax: 0.7, zeta: 0.22, bef: 1.38 },
  "Bambusa bambos": { common: "Bamboo", Hm: 25, rho: 600, k: 0.30, Dmax: 0.15, zeta: 0.35, bef: 1.20 },
  "Leucaena leucocephala": { common: "Subabul", Hm: 15, rho: 520, k: 0.20, Dmax: 0.4, zeta: 0.30, bef: 1.35 },
};

// T-model + Chapman-Richards calculations
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
    // Diameter (Chapman-Richards growth model)
    const D = traits.Dmax * Math.pow(1 - Math.exp(-traits.k * year), 1.3);
    
    // Height (T-model from Plant-FATE)
    const H = Math.max(1.3, traits.Hm * (1 - Math.exp(-50 * D / traits.Hm)));
    
    // Survival rate
    const survival = Math.max(0.1, Math.exp(-annualMortality * year));
    const survivingTrees = Math.floor(quantity * survival);
    
    // Volume-based biomass
    const volume = (Math.PI / 4) * D * D * H * formFactor;
    const agbVolume = volume * traits.rho * traits.bef;
    
    // Chave et al. 2014 pantropical equation
    const Dcm = D * 100;
    const agbChave = 0.0673 * Math.pow((traits.rho/1000) * Dcm * Dcm * H, 0.976);
    
    // Average of both methods
    const agbPerTree = (agbVolume + agbChave) / 2;
    const bgbPerTree = agbPerTree * traits.zeta;
    
    const totalAgb = agbPerTree * survivingTrees / 1000;
    const totalBgb = bgbPerTree * survivingTrees / 1000;
    const totalCarbon = (totalAgb + totalBgb) * carbonFraction;
    const co2eq = totalCarbon * 3.67;
    
    results.push({
      year,
      dbh: parseFloat((D * 100).toFixed(1)),
      height: parseFloat(H.toFixed(1)),
      survival: parseFloat((survival * 100).toFixed(1)),
      survivingTrees,
      agb: parseFloat(totalAgb.toFixed(1)),
      bgb: parseFloat(totalBgb.toFixed(1)),
      biomass: parseFloat((totalAgb + totalBgb).toFixed(1)),
      carbon: parseFloat(totalCarbon.toFixed(1)),
      co2: parseFloat(co2eq.toFixed(1)),
    });
  }
  
  return results;
};

export default function CarbonStockModel() {
  const [species, setSpecies] = useState("Tectona grandis");
  const [quantity, setQuantity] = useState(1000);
  const [years, setYears] = useState(40);
  const [view, setView] = useState('carbon');
  
  const projection = useMemo(() => 
    calculateProjection(species, quantity, years),
    [species, quantity, years]
  );
  
  const finalYear = projection[projection.length - 1];
  const traits = SPECIES_DATABASE[species];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-green-800 mb-1">🌳 Carbon Stock Assessment Model</h1>
          <p className="text-sm text-green-600">T-model + Chapman-Richards | Indian Species Database</p>
        </div>
        
        {/* Input Controls */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Species</label>
              <select 
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                {Object.entries(SPECIES_DATABASE).map(([sci, data]) => (
                  <option key={sci} value={sci}>{data.common} ({sci})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Number of Trees</label>
              <input 
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                min="1"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Years to Project</label>
              <input 
                type="number"
                value={years}
                onChange={(e) => setYears(Math.min(100, Math.max(1, parseInt(e.target.value) || 40)))}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                min="1"
                max="100"
              />
            </div>
          </div>
          
          {/* Species Traits */}
          {traits && (
            <div className="mt-3 p-3 bg-green-50 rounded-lg">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                <div><span className="text-gray-500">Max H:</span> <span className="font-semibold">{traits.Hm}m</span></div>
                <div><span className="text-gray-500">ρ:</span> <span className="font-semibold">{traits.rho} kg/m³</span></div>
                <div><span className="text-gray-500">k:</span> <span className="font-semibold">{traits.k}</span></div>
                <div><span className="text-gray-500">Dmax:</span> <span className="font-semibold">{traits.Dmax*100}cm</span></div>
                <div><span className="text-gray-500">ζ (R:S):</span> <span className="font-semibold">{traits.zeta}</span></div>
                <div><span className="text-gray-500">BEF:</span> <span className="font-semibold">{traits.bef}</span></div>
              </div>
            </div>
          )}
        </div>
        
        {/* Summary Cards */}
        {finalYear && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-xl shadow p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{finalYear.carbon.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Tonnes Carbon</div>
            </div>
            <div className="bg-white rounded-xl shadow p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{finalYear.co2.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Tonnes CO₂eq</div>
            </div>
            <div className="bg-white rounded-xl shadow p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{finalYear.biomass.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Tonnes Biomass</div>
            </div>
            <div className="bg-white rounded-xl shadow p-3 text-center">
              <div className="text-2xl font-bold text-emerald-600">{finalYear.survivingTrees.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Surviving Trees</div>
            </div>
          </div>
        )}
        
        {/* Chart Tabs */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {[
            { id: 'carbon', label: '🌿 Carbon' },
            { id: 'biomass', label: '🪵 Biomass' },
            { id: 'growth', label: '📏 Growth' },
            { id: 'co2', label: '💨 CO₂' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                view === v.id 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-green-100'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        
        {/* Chart */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <ResponsiveContainer width="100%" height={300}>
            {view === 'carbon' && (
              <LineChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="carbon" stroke="#16a34a" strokeWidth={2} name="Carbon (t C)" dot={false} />
              </LineChart>
            )}
            
            {view === 'biomass' && (
              <AreaChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="bgb" stackId="1" stroke="#8B4513" fill="#8B4513" name="BGB (t)" />
                <Area type="monotone" dataKey="agb" stackId="1" stroke="#228B22" fill="#228B22" name="AGB (t)" />
              </AreaChart>
            )}
            
            {view === 'growth' && (
              <LineChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize: 11}} />
                <YAxis yAxisId="left" tick={{fontSize: 11}} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 11}} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="dbh" stroke="#3b82f6" strokeWidth={2} name="DBH (cm)" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="height" stroke="#22c55e" strokeWidth={2} name="Height (m)" dot={false} />
              </LineChart>
            )}
            
            {view === 'co2' && (
              <AreaChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="co2" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.3} name="CO₂eq (t)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
        
        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-lg p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-3">Projection Data</h3>
          <table className="w-full text-xs">
            <thead className="bg-green-50">
              <tr>
                <th className="p-2 text-left">Year</th>
                <th className="p-2 text-right">DBH</th>
                <th className="p-2 text-right">Height</th>
                <th className="p-2 text-right">Survival</th>
                <th className="p-2 text-right">AGB</th>
                <th className="p-2 text-right">BGB</th>
                <th className="p-2 text-right">Carbon</th>
                <th className="p-2 text-right">CO₂eq</th>
              </tr>
            </thead>
            <tbody>
              {projection.filter((_, i) => [0, 4, 9, 14, 19, 29, 39].includes(i) || i === projection.length - 1).map((row) => (
                <tr key={row.year} className="border-b hover:bg-green-50">
                  <td className="p-2 font-medium">{row.year}</td>
                  <td className="p-2 text-right">{row.dbh} cm</td>
                  <td className="p-2 text-right">{row.height} m</td>
                  <td className="p-2 text-right">{row.survival}%</td>
                  <td className="p-2 text-right">{row.agb} t</td>
                  <td className="p-2 text-right">{row.bgb} t</td>
                  <td className="p-2 text-right font-semibold text-green-600">{row.carbon} t</td>
                  <td className="p-2 text-right font-semibold text-blue-600">{row.co2} t</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="text-center mt-4 text-xs text-gray-500">
          Based on T-model (Plant-FATE, Joshi 2023) & P-hydro (Joshi 2022) | Species data: FSI, ICFRE
        </div>
      </div>
    </div>
  );
}
