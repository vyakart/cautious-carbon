# Carbon Stock Assessment Model

A Python-based model for projecting Aboveground Biomass (AGB) and Belowground Biomass (BGB) for tree plantations over 40 years.

## Scientific Basis

This model is based on the following scientific frameworks:

1. **T-model** (Li et al. 2014, Plant-FATE paper) - Dimensional scaling relationships:
   - Height-diameter: `H = Hm × (1 - exp(-a×D/Hm))`
   - Crown area scaling
   - Stem volume calculations

2. **Chapman-Richards Growth Model** - For diameter increment:
   - `D(t) = Dmax × (1 - exp(-k×t))^p`

3. **Chave et al. (2014)** - Pantropical allometric equation:
   - `AGB = 0.0673 × (ρ × D² × H)^0.976`

4. **Indian Forestry Research** - Species-specific parameters from:
   - Forest Survey of India volume equations
   - ICFRE Carbon Stock Assessment Manual
   - Published Indian forestry research

## Installation

```bash
# Clone or download the model
cd carbon_model

# Install dependencies
pip install numpy pandas matplotlib

# Optional: for Jupyter notebook support
pip install jupyter
```

## Quick Start

### 1. Run the Demo

```bash
python demo.py
```

This runs all demonstrations showing model capabilities.

### 2. Interactive Mode

```bash
python run_model.py --interactive
```

Follow the prompts to:
- Select a species from the database (30+ Indian species)
- Enter number of trees
- Enter planting date
- Get 40-year projections

### 3. Single Species Projection

```bash
python run_model.py --species "Tectona grandis" --quantity 1000 --date 2025-01-01 --output teak_results.csv
```

### 4. Multiple Species from CSV

Create a CSV file with your plantings:

```csv
species_name,quantity,planting_date,location,spacing_m
Tectona grandis,500,2025-01-15,Maharashtra,3.0
Eucalyptus tereticornis,1000,2025-01-15,Tamil Nadu,2.5
```

Then run:

```bash
python run_model.py --csv plantings.csv --output results.csv
```

## Available Species (30+ Indian Species)

| Category | Species |
|----------|---------|
| **Plantation** | Teak, Eucalyptus, Poplar, Casuarina, Acacia |
| **Native Forest** | Sal, Arjun, Haldu, Jarul |
| **Agroforestry** | Neem, Mango, Tamarind, Moringa, Subabul, Jamun |
| **Himalayan** | Deodar, Chir Pine, Banj Oak |
| **Bamboo** | Bambusa bambos, Dendrocalamus strictus |

To see all species:
```bash
python run_model.py --list-species
```

## Model Inputs

| Input | Description | Example |
|-------|-------------|---------|
| `species_name` | Scientific name | "Tectona grandis" |
| `quantity` | Number of trees | 1000 |
| `planting_date` | Date planted | 2025-01-01 |
| `years` | Projection period | 40 (default) |

## Model Outputs

| Output | Description | Unit |
|--------|-------------|------|
| `dbh_cm` | Diameter at breast height | cm |
| `height_m` | Tree height | m |
| `surviving_trees` | Trees surviving | count |
| `survival_rate` | Proportion surviving | 0-1 |
| `agb_kg_per_tree` | AGB per tree | kg |
| `bgb_kg_per_tree` | BGB per tree | kg |
| `total_agb_tonnes` | Total AGB | tonnes |
| `total_bgb_tonnes` | Total BGB | tonnes |
| `total_carbon_tonnes` | Total carbon stock | tonnes C |
| `co2_equivalent_tonnes` | CO2 equivalent | tonnes CO2 |

## Python API Usage

```python
from carbon_stock_model import CarbonStockModel, PlantingRecord
from datetime import datetime

# Initialize model
model = CarbonStockModel()

# Single species projection
results = model.project_single_species(
    species_name="Tectona grandis",
    quantity=1000,
    planting_date=datetime(2025, 1, 1),
    years=40
)

# View results
print(results[['year', 'total_carbon_tonnes', 'co2_equivalent_tonnes']])

# Multiple species
plantings = [
    PlantingRecord("Tectona grandis", 500, datetime(2025, 1, 1)),
    PlantingRecord("Eucalyptus tereticornis", 1000, datetime(2025, 1, 1)),
]
summary, detailed = model.project_mixed_planting(plantings, years=40)
```

## Generating Visualizations

```python
from visualizations import (
    plot_carbon_trajectory,
    plot_species_comparison,
    plot_mixed_planting_summary,
    generate_report_charts
)
from carbon_stock_model import CarbonStockModel

model = CarbonStockModel()

# Single species chart
results = model.project_single_species("Tectona grandis", 1000, datetime(2025,1,1), 40)
plot_carbon_trajectory(results, "Tectona grandis", 1000, save_path="teak_chart.png")

# Species comparison
species = ["Tectona grandis", "Eucalyptus tereticornis", "Populus deltoides"]
plot_species_comparison(model, species, save_path="comparison.png")

# Full report from CSV
generate_report_charts(model, "sample_plantings.csv", output_dir="charts/")
```

## Adding Custom Species

```python
from carbon_stock_model import CarbonStockModel, SpeciesTraits

model = CarbonStockModel()

# Define new species
new_species = SpeciesTraits(
    species_name="Santalum album",
    common_name="Sandalwood",
    Hm=12.0,          # Max height (m)
    rho=920,          # Wood density (kg/m³)
    a=35.0,           # Stem slenderness
    c=280,            # Crown-sapwood ratio
    zeta=0.30,        # Root-to-shoot ratio
    k_growth=0.03,    # Growth rate parameter
    D_max=0.4,        # Max DBH (m)
    bef=1.50,         # Biomass expansion factor
)

# Add to model
model.species_db["Santalum album"] = new_species

# Now use it
results = model.project_single_species("Santalum album", 1000, datetime(2025,1,1), 40)
```

## Key Parameters Explained

### Species Traits

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| `Hm` | Maximum asymptotic height | 10-50 m |
| `rho` | Wood density | 350-900 kg/m³ |
| `a` | Stem slenderness ratio | 30-80 |
| `zeta` | Root-to-shoot ratio | 0.15-0.40 |
| `k_growth` | Growth rate coefficient | 0.03-0.30 |
| `D_max` | Maximum DBH | 0.3-1.2 m |
| `bef` | Biomass expansion factor | 1.2-1.7 |

### Model Assumptions

1. **Mortality**: Exponential with base rate of 2%/year, modified by wood density
2. **Carbon fraction**: 47% of dry biomass (IPCC refined value)
3. **CO2 conversion**: C × 3.67 (molecular weight ratio 44/12)
4. **Form factor**: 0.42 (tropical tree average)

## File Structure

```
carbon_model/
├── carbon_stock_model.py   # Core model with species database
├── run_model.py            # CLI interface
├── visualizations.py       # Chart generation
├── demo.py                 # Demonstration script
├── sample_plantings.csv    # Example input data
├── README.md               # This file
└── requirements.txt        # Dependencies
```

## Validation

The model has been designed based on:
- Published allometric equations for Indian species
- FSI volume equations validated across Indian forests
- ICFRE carbon assessment protocols
- Comparison with CO2FIX model outputs

For production use, we recommend:
1. Validate against your historical data
2. Calibrate growth parameters for your specific conditions
3. Consider site-specific factors (soil, climate, management)

## References

1. Joshi, J. et al. (2022). Towards a unified theory of plant photosynthesis and hydraulics. *Nature Plants*.
2. Joshi, J. et al. (2023). Plant-FATE: A trait-size-structured eco-evolutionary vegetation model. *BioRxiv*.
3. Chave, J. et al. (2014). Improved allometric models to estimate the aboveground biomass of tropical trees. *Global Change Biology*.
4. FSI (2021). Volume Equations for Forests of India, Nepal and Bhutan.
5. ICFRE. Forest Carbon Stock Assessment Manual.

## License

MIT License - Free to use and modify.

## Contact

For questions or contributions, contact Medius Earth.
