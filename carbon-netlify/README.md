# 🌳 Carbon Stock Assessment Model

A web-based tool for projecting Aboveground Biomass (AGB) and Belowground Biomass (BGB) for Indian tree plantations over 40 years.

**Live Demo:** [https://cautious-carbon.netlify.app](https://cautious-carbon.netlify.app)

## Features

- **18 Indian tree species** with trait-based parameters
- **40-year carbon projections** with annual breakdown
- **Interactive charts** (Carbon, Biomass, Growth, CO₂)
- **Species comparison** tool
- **CSV export** functionality
- **Mobile responsive** design

## Scientific Basis

| Component | Method |
|-----------|--------|
| Growth | Chapman-Richards: `D(t) = Dmax × (1 - e^(-kt))^1.3` |
| Height | T-model: `H = Hm × (1 - e^(-50D/Hm))` |
| Biomass | Volume-based + Chave et al. (2014) pantropical |
| BGB | Species-specific root:shoot ratios |
| Carbon | 47% of dry biomass (IPCC refined) |
| CO₂ | Carbon × 3.67 |

## Data Sources

- **Plant-FATE** (Joshi et al., 2023) - T-model parameters
- **P-hydro** (Joshi et al., 2022) - Hydraulic traits
- **FSI** - Volume equations for India
- **ICFRE** - Carbon stock assessment manual
- **Chave et al. (2014)** - Pantropical allometric equations

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Recharts
- Netlify

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Deployment

This app is configured for Netlify deployment:

1. Push to GitHub
2. Connect repo to Netlify
3. Deploy automatically

## Species Database

| Species | Common Name | Category |
|---------|-------------|----------|
| Tectona grandis | Teak | Plantation |
| Eucalyptus tereticornis | Eucalyptus | Plantation |
| Populus deltoides | Poplar | Agroforestry |
| Dalbergia sissoo | Shisham | Native |
| Azadirachta indica | Neem | Agroforestry |
| Shorea robusta | Sal | Native |
| + 12 more species... | | |

## License

MIT License

## Author

Medius Earth
