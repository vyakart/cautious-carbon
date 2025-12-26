"""
Carbon Stock Assessment Model
=============================
A trait-based model for projecting Aboveground Biomass (AGB) and Belowground Biomass (BGB)
for tree plantations over 40 years.

Scientific basis:
- T-model (Li et al. 2014, Plant-FATE) for dimensional scaling
- Chapman-Richards growth curves for diameter increment
- Species-specific allometric equations where available
- Root-to-shoot ratios from Indian forestry research

Author: Medius Earth
Version: 1.0.0
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import json
import warnings


@dataclass
class SpeciesTraits:
    """
    Species-specific traits for carbon stock modeling.
    
    Attributes from Plant-FATE / P-hydro papers:
    - Hm: Maximum asymptotic height (m)
    - rho: Wood density (kg/m³)
    - a: Stem slenderness ratio (dimensionless)
    - c: Crown area to sapwood area ratio
    - zeta: Root-to-shoot ratio (fine root mass per leaf area, simplified to BGB/AGB ratio)
    - k_growth: Growth rate parameter for Chapman-Richards curve
    - D_max: Maximum diameter at breast height (m)
    """
    species_name: str
    common_name: str
    Hm: float  # Maximum height (m)
    rho: float  # Wood density (kg/m³)
    a: float = 50.0  # Stem slenderness (default)
    c: float = 300.0  # Crown-sapwood ratio (default)
    zeta: float = 0.25  # Root-to-shoot ratio
    k_growth: float = 0.08  # Growth rate parameter
    D_max: float = 0.8  # Maximum DBH (m)
    carbon_fraction: float = 0.47  # Carbon content of dry biomass
    bef: float = 1.3  # Biomass expansion factor (includes branches, leaves)
    
    # Additional metadata
    native_region: str = "India"
    forest_type: str = "Tropical"
    rotation_age: int = 40  # Typical rotation age in years


@dataclass
class PlantingRecord:
    """Record of a tree planting event."""
    species_name: str
    quantity: int
    planting_date: datetime
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    spacing_m: float = 3.0  # Default spacing in meters


class CarbonStockModel:
    """
    Main carbon stock assessment model.
    
    Uses the T-model framework from Plant-FATE for dimensional scaling:
    - Height: H = Hm * (1 - exp(-a*D/Hm))
    - Crown area: Ac = (π*c/4a) * D * H
    - Stem volume: V = (π/4) * D² * H * form_factor
    
    Growth is modeled using Chapman-Richards:
    - D(t) = D_max * (1 - exp(-k*t))^p
    """
    
    def __init__(self, species_db: Dict[str, SpeciesTraits] = None):
        """
        Initialize the model with a species database.
        
        Args:
            species_db: Dictionary mapping species names to SpeciesTraits objects
        """
        self.species_db = species_db or self._load_default_species_db()
        self.form_factor = 0.42  # Average stem form factor for tropical trees
        self.mortality_base = 0.02  # Base annual mortality rate (2%)
        
    def _load_default_species_db(self) -> Dict[str, SpeciesTraits]:
        """Load the default Indian species database."""
        return INDIAN_SPECIES_DATABASE
    
    def get_available_species(self) -> List[str]:
        """Return list of available species in the database."""
        return list(self.species_db.keys())
    
    def diameter_at_age(self, age: float, traits: SpeciesTraits) -> float:
        """
        Calculate diameter at breast height (DBH) for a given age.
        
        Uses Chapman-Richards growth model:
        D(t) = D_max * (1 - exp(-k*t))^p
        
        Args:
            age: Tree age in years
            traits: Species traits
            
        Returns:
            DBH in meters
        """
        p = 1.3  # Shape parameter (typical for tropical trees)
        D = traits.D_max * (1 - np.exp(-traits.k_growth * age)) ** p
        return max(0.01, D)  # Minimum 1cm DBH
    
    def height_from_diameter(self, D: float, traits: SpeciesTraits) -> float:
        """
        Calculate tree height from diameter using T-model.
        
        H = Hm * (1 - exp(-a*D/Hm))
        
        Args:
            D: Diameter at breast height (m)
            traits: Species traits
            
        Returns:
            Tree height in meters
        """
        H = traits.Hm * (1 - np.exp(-traits.a * D / traits.Hm))
        return max(1.3, H)  # Minimum height at breast height
    
    def stem_volume(self, D: float, H: float) -> float:
        """
        Calculate stem volume using standard forestry formula.
        
        V = (π/4) * D² * H * form_factor
        
        Args:
            D: DBH in meters
            H: Height in meters
            
        Returns:
            Stem volume in m³
        """
        return (np.pi / 4) * D**2 * H * self.form_factor
    
    def aboveground_biomass(self, D: float, H: float, traits: SpeciesTraits) -> float:
        """
        Calculate aboveground biomass (AGB) for a single tree.
        
        AGB = Volume * Wood_density * BEF
        
        Uses the Chave et al. (2014) approach adapted for Indian species.
        
        Args:
            D: DBH in meters
            H: Height in meters
            traits: Species traits
            
        Returns:
            AGB in kg (dry weight)
        """
        # Method 1: Volume-based (traditional forestry)
        volume = self.stem_volume(D, H)
        agb_volume = volume * traits.rho * traits.bef
        
        # Method 2: Allometric (Chave et al. 2014 pantropical)
        # AGB = 0.0673 * (rho * D² * H)^0.976
        D_cm = D * 100  # Convert to cm for Chave equation
        agb_chave = 0.0673 * (traits.rho/1000 * D_cm**2 * H) ** 0.976
        
        # Use average of both methods for robustness
        return (agb_volume + agb_chave) / 2
    
    def belowground_biomass(self, agb: float, traits: SpeciesTraits) -> float:
        """
        Calculate belowground biomass (BGB) from AGB.
        
        BGB = AGB * root_to_shoot_ratio
        
        Uses species-specific ratios where available, otherwise IPCC defaults.
        
        Args:
            agb: Aboveground biomass in kg
            traits: Species traits
            
        Returns:
            BGB in kg (dry weight)
        """
        return agb * traits.zeta
    
    def carbon_stock(self, biomass: float, traits: SpeciesTraits) -> float:
        """
        Convert biomass to carbon stock.
        
        Args:
            biomass: Dry biomass in kg
            traits: Species traits
            
        Returns:
            Carbon stock in kg C
        """
        return biomass * traits.carbon_fraction
    
    def survival_rate(self, age: float, traits: SpeciesTraits) -> float:
        """
        Calculate cumulative survival rate to a given age.
        
        Uses a simple exponential mortality model with wood density effect.
        Higher wood density = lower mortality (more durable trees).
        
        Args:
            age: Tree age in years
            traits: Species traits
            
        Returns:
            Proportion of trees surviving (0-1)
        """
        # Wood density effect on mortality (from Plant-FATE)
        rho_ref = 600  # Reference wood density
        mortality_modifier = (rho_ref / traits.rho) ** 0.5
        
        # Annual mortality rate
        annual_mortality = self.mortality_base * mortality_modifier
        
        # Cumulative survival
        survival = np.exp(-annual_mortality * age)
        return max(0.1, survival)  # At least 10% survival
    
    def project_single_species(
        self, 
        species_name: str, 
        quantity: int, 
        planting_date: datetime,
        years: int = 40
    ) -> pd.DataFrame:
        """
        Project carbon stocks for a single species planting.
        
        Args:
            species_name: Name of the species (must be in database)
            quantity: Number of trees planted
            planting_date: Date of planting
            years: Number of years to project (default 40)
            
        Returns:
            DataFrame with annual projections
        """
        if species_name not in self.species_db:
            raise ValueError(f"Species '{species_name}' not found in database. "
                           f"Available: {self.get_available_species()}")
        
        traits = self.species_db[species_name]
        
        results = []
        for year in range(1, years + 1):
            age = year
            date = planting_date + timedelta(days=365 * year)
            
            # Calculate dimensions
            D = self.diameter_at_age(age, traits)
            H = self.height_from_diameter(D, traits)
            
            # Calculate biomass per tree
            agb_per_tree = self.aboveground_biomass(D, H, traits)
            bgb_per_tree = self.belowground_biomass(agb_per_tree, traits)
            total_biomass_per_tree = agb_per_tree + bgb_per_tree
            
            # Calculate carbon per tree
            carbon_per_tree = self.carbon_stock(total_biomass_per_tree, traits)
            agb_carbon_per_tree = self.carbon_stock(agb_per_tree, traits)
            bgb_carbon_per_tree = self.carbon_stock(bgb_per_tree, traits)
            
            # Account for mortality
            survival = self.survival_rate(age, traits)
            surviving_trees = int(quantity * survival)
            
            # Total stocks
            total_agb = agb_per_tree * surviving_trees
            total_bgb = bgb_per_tree * surviving_trees
            total_carbon = carbon_per_tree * surviving_trees
            
            # Convert to tonnes
            results.append({
                'year': year,
                'date': date.strftime('%Y-%m-%d'),
                'age_years': age,
                'dbh_cm': D * 100,
                'height_m': H,
                'surviving_trees': surviving_trees,
                'survival_rate': survival,
                'agb_kg_per_tree': agb_per_tree,
                'bgb_kg_per_tree': bgb_per_tree,
                'total_agb_tonnes': total_agb / 1000,
                'total_bgb_tonnes': total_bgb / 1000,
                'total_biomass_tonnes': (total_agb + total_bgb) / 1000,
                'total_carbon_tonnes': total_carbon / 1000,
                'co2_equivalent_tonnes': total_carbon / 1000 * 3.67,  # CO2 = C * 44/12
            })
        
        return pd.DataFrame(results)
    
    def project_mixed_planting(
        self, 
        plantings: List[PlantingRecord],
        years: int = 40
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Project carbon stocks for multiple species/plantings.
        
        Args:
            plantings: List of PlantingRecord objects
            years: Number of years to project
            
        Returns:
            Tuple of (summary_df, detailed_df)
        """
        all_projections = []
        
        for planting in plantings:
            df = self.project_single_species(
                planting.species_name,
                planting.quantity,
                planting.planting_date,
                years
            )
            df['species'] = planting.species_name
            df['initial_quantity'] = planting.quantity
            df['planting_date'] = planting.planting_date.strftime('%Y-%m-%d')
            all_projections.append(df)
        
        detailed_df = pd.concat(all_projections, ignore_index=True)
        
        # Create summary by year
        summary_df = detailed_df.groupby('year').agg({
            'surviving_trees': 'sum',
            'total_agb_tonnes': 'sum',
            'total_bgb_tonnes': 'sum',
            'total_biomass_tonnes': 'sum',
            'total_carbon_tonnes': 'sum',
            'co2_equivalent_tonnes': 'sum'
        }).reset_index()
        
        return summary_df, detailed_df


# =============================================================================
# INDIAN SPECIES DATABASE
# =============================================================================
# Data compiled from:
# - Plant-FATE paper (Joshi et al. 2023) - model parameters
# - P-hydro paper (Joshi et al. 2022) - hydraulic traits
# - FSI Volume Equations for India
# - ICFRE Carbon Stock Assessment Manual
# - Published Indian forestry research
# =============================================================================

INDIAN_SPECIES_DATABASE = {
    # =========================================================================
    # PLANTATION SPECIES (High priority for carbon projects)
    # =========================================================================
    
    "Tectona grandis": SpeciesTraits(
        species_name="Tectona grandis",
        common_name="Teak",
        Hm=35.0,  # Max height in m
        rho=550,  # Wood density kg/m³
        a=45.0,   # Slenderness
        c=280,    # Crown-sapwood ratio
        zeta=0.21,  # Root-to-shoot ratio (from ICFRE)
        k_growth=0.06,  # Slower growth
        D_max=0.9,
        bef=1.46,
        rotation_age=50,
        forest_type="Tropical Moist Deciduous"
    ),
    
    "Eucalyptus tereticornis": SpeciesTraits(
        species_name="Eucalyptus tereticornis",
        common_name="Mysore Gum / Eucalyptus",
        Hm=45.0,
        rho=640,
        a=55.0,
        c=250,
        zeta=0.17,  # Lower root-to-shoot for Eucalyptus
        k_growth=0.15,  # Fast growth
        D_max=0.7,
        bef=1.31,
        rotation_age=8,
        forest_type="Plantation"
    ),
    
    "Eucalyptus globulus": SpeciesTraits(
        species_name="Eucalyptus globulus",
        common_name="Blue Gum",
        Hm=40.0,
        rho=650,
        a=52.0,
        c=240,
        zeta=0.16,
        k_growth=0.14,
        D_max=0.65,
        bef=1.28,
        rotation_age=10,
        forest_type="Plantation"
    ),
    
    "Populus deltoides": SpeciesTraits(
        species_name="Populus deltoides",
        common_name="Poplar",
        Hm=30.0,
        rho=380,
        a=60.0,
        c=320,
        zeta=0.20,
        k_growth=0.18,  # Very fast growth
        D_max=0.6,
        bef=1.35,
        rotation_age=7,
        forest_type="Agroforestry"
    ),
    
    "Casuarina equisetifolia": SpeciesTraits(
        species_name="Casuarina equisetifolia",
        common_name="Casuarina / She-oak",
        Hm=25.0,
        rho=830,
        a=65.0,
        c=200,
        zeta=0.22,
        k_growth=0.12,
        D_max=0.45,
        bef=1.25,
        rotation_age=10,
        forest_type="Coastal Plantation"
    ),
    
    "Acacia auriculiformis": SpeciesTraits(
        species_name="Acacia auriculiformis",
        common_name="Acacia / Australian Wattle",
        Hm=25.0,
        rho=550,
        a=48.0,
        c=280,
        zeta=0.24,
        k_growth=0.13,
        D_max=0.5,
        bef=1.32,
        rotation_age=12,
        forest_type="Plantation"
    ),
    
    "Acacia mangium": SpeciesTraits(
        species_name="Acacia mangium",
        common_name="Mangium",
        Hm=30.0,
        rho=500,
        a=50.0,
        c=290,
        zeta=0.23,
        k_growth=0.14,
        D_max=0.55,
        bef=1.30,
        rotation_age=10,
        forest_type="Plantation"
    ),
    
    "Gmelina arborea": SpeciesTraits(
        species_name="Gmelina arborea",
        common_name="Gamhar / White Teak",
        Hm=30.0,
        rho=430,
        a=45.0,
        c=300,
        zeta=0.22,
        k_growth=0.12,
        D_max=0.7,
        bef=1.38,
        rotation_age=15,
        forest_type="Tropical Moist Deciduous"
    ),
    
    "Dalbergia sissoo": SpeciesTraits(
        species_name="Dalbergia sissoo",
        common_name="Shisham / Indian Rosewood",
        Hm=25.0,
        rho=770,
        a=42.0,
        c=260,
        zeta=0.33,  # Higher root allocation
        k_growth=0.07,
        D_max=0.8,
        bef=1.70,
        rotation_age=40,
        forest_type="Tropical Dry Deciduous"
    ),
    
    # =========================================================================
    # NATIVE FOREST SPECIES
    # =========================================================================
    
    "Shorea robusta": SpeciesTraits(
        species_name="Shorea robusta",
        common_name="Sal",
        Hm=35.0,
        rho=720,
        a=40.0,
        c=250,
        zeta=0.27,
        k_growth=0.05,  # Slow growth
        D_max=1.0,
        bef=1.30,
        rotation_age=80,
        forest_type="Tropical Moist Deciduous"
    ),
    
    "Terminalia arjuna": SpeciesTraits(
        species_name="Terminalia arjuna",
        common_name="Arjun",
        Hm=25.0,
        rho=680,
        a=44.0,
        c=270,
        zeta=0.25,
        k_growth=0.08,
        D_max=0.7,
        bef=1.35,
        rotation_age=30,
        forest_type="Riparian"
    ),
    
    "Terminalia tomentosa": SpeciesTraits(
        species_name="Terminalia tomentosa",
        common_name="Ain / Laurel",
        Hm=30.0,
        rho=750,
        a=43.0,
        c=260,
        zeta=0.26,
        k_growth=0.06,
        D_max=0.8,
        bef=1.32,
        rotation_age=50,
        forest_type="Tropical Dry Deciduous"
    ),
    
    "Adina cordifolia": SpeciesTraits(
        species_name="Adina cordifolia",
        common_name="Haldu",
        Hm=25.0,
        rho=640,
        a=46.0,
        c=280,
        zeta=0.24,
        k_growth=0.07,
        D_max=0.65,
        bef=1.36,
        rotation_age=40,
        forest_type="Tropical Moist Deciduous"
    ),
    
    "Lagerstroemia speciosa": SpeciesTraits(
        species_name="Lagerstroemia speciosa",
        common_name="Pride of India / Jarul",
        Hm=20.0,
        rho=560,
        a=48.0,
        c=290,
        zeta=0.23,
        k_growth=0.09,
        D_max=0.5,
        bef=1.40,
        rotation_age=25,
        forest_type="Tropical Moist Deciduous"
    ),
    
    # =========================================================================
    # AGROFORESTRY & MULTIPURPOSE SPECIES
    # =========================================================================
    
    "Azadirachta indica": SpeciesTraits(
        species_name="Azadirachta indica",
        common_name="Neem",
        Hm=20.0,
        rho=690,
        a=40.0,
        c=300,
        zeta=0.25,
        k_growth=0.08,
        D_max=0.6,
        bef=1.45,
        rotation_age=30,
        forest_type="Agroforestry"
    ),
    
    "Mangifera indica": SpeciesTraits(
        species_name="Mangifera indica",
        common_name="Mango",
        Hm=25.0,
        rho=550,
        a=35.0,  # Lower slenderness (spreading crown)
        c=350,
        zeta=0.29,  # Higher root allocation for fruit trees
        k_growth=0.07,
        D_max=0.8,
        bef=1.55,
        rotation_age=50,
        forest_type="Agroforestry"
    ),
    
    "Tamarindus indica": SpeciesTraits(
        species_name="Tamarindus indica",
        common_name="Tamarind",
        Hm=25.0,
        rho=880,
        a=38.0,
        c=320,
        zeta=0.28,
        k_growth=0.05,
        D_max=0.9,
        bef=1.50,
        rotation_age=60,
        forest_type="Agroforestry"
    ),
    
    "Moringa oleifera": SpeciesTraits(
        species_name="Moringa oleifera",
        common_name="Drumstick / Moringa",
        Hm=12.0,
        rho=350,
        a=55.0,
        c=280,
        zeta=0.20,
        k_growth=0.25,  # Very fast growth
        D_max=0.35,
        bef=1.60,
        rotation_age=10,
        forest_type="Agroforestry"
    ),
    
    "Pongamia pinnata": SpeciesTraits(
        species_name="Pongamia pinnata",
        common_name="Karanj / Pongam",
        Hm=18.0,
        rho=620,
        a=42.0,
        c=300,
        zeta=0.26,
        k_growth=0.09,
        D_max=0.5,
        bef=1.42,
        rotation_age=25,
        forest_type="Agroforestry"
    ),
    
    "Leucaena leucocephala": SpeciesTraits(
        species_name="Leucaena leucocephala",
        common_name="Subabul",
        Hm=15.0,
        rho=520,
        a=55.0,
        c=260,
        zeta=0.30,  # N-fixing, high root allocation
        k_growth=0.20,
        D_max=0.4,
        bef=1.35,
        rotation_age=8,
        forest_type="Agroforestry"
    ),
    
    "Syzygium cumini": SpeciesTraits(
        species_name="Syzygium cumini",
        common_name="Jamun / Java Plum",
        Hm=25.0,
        rho=680,
        a=44.0,
        c=280,
        zeta=0.24,
        k_growth=0.08,
        D_max=0.7,
        bef=1.38,
        rotation_age=40,
        forest_type="Agroforestry"
    ),
    
    "Albizia lebbeck": SpeciesTraits(
        species_name="Albizia lebbeck",
        common_name="Siris",
        Hm=25.0,
        rho=560,
        a=48.0,
        c=310,
        zeta=0.28,
        k_growth=0.10,
        D_max=0.6,
        bef=1.40,
        rotation_age=20,
        forest_type="Agroforestry"
    ),
    
    "Albizia procera": SpeciesTraits(
        species_name="Albizia procera",
        common_name="White Siris / Safed Siris",
        Hm=30.0,
        rho=510,
        a=50.0,
        c=300,
        zeta=0.27,
        k_growth=0.11,
        D_max=0.65,
        bef=1.38,
        rotation_age=18,
        forest_type="Plantation"
    ),
    
    "Melia azedarach": SpeciesTraits(
        species_name="Melia azedarach",
        common_name="Bakain / Persian Lilac",
        Hm=18.0,
        rho=480,
        a=50.0,
        c=290,
        zeta=0.22,
        k_growth=0.14,
        D_max=0.5,
        bef=1.42,
        rotation_age=15,
        forest_type="Agroforestry"
    ),
    
    "Bambusa bambos": SpeciesTraits(
        species_name="Bambusa bambos",
        common_name="Bamboo (Giant Thorny)",
        Hm=25.0,
        rho=600,
        a=80.0,  # Very slender
        c=150,
        zeta=0.35,  # High root allocation for bamboo
        k_growth=0.30,  # Very fast
        D_max=0.15,  # Culm diameter
        bef=1.20,
        rotation_age=5,
        forest_type="Plantation"
    ),
    
    "Dendrocalamus strictus": SpeciesTraits(
        species_name="Dendrocalamus strictus",
        common_name="Bamboo (Male/Solid)",
        Hm=15.0,
        rho=700,
        a=85.0,
        c=140,
        zeta=0.40,
        k_growth=0.28,
        D_max=0.10,
        bef=1.18,
        rotation_age=4,
        forest_type="Dry Deciduous"
    ),
    
    # =========================================================================
    # HIMALAYAN / TEMPERATE SPECIES
    # =========================================================================
    
    "Cedrus deodara": SpeciesTraits(
        species_name="Cedrus deodara",
        common_name="Deodar Cedar",
        Hm=50.0,
        rho=550,
        a=35.0,
        c=220,
        zeta=0.20,
        k_growth=0.04,  # Slow growth
        D_max=1.2,
        bef=1.25,
        rotation_age=100,
        forest_type="Himalayan Conifer"
    ),
    
    "Pinus roxburghii": SpeciesTraits(
        species_name="Pinus roxburghii",
        common_name="Chir Pine",
        Hm=35.0,
        rho=510,
        a=40.0,
        c=200,
        zeta=0.18,
        k_growth=0.06,
        D_max=0.9,
        bef=1.22,
        rotation_age=60,
        forest_type="Himalayan Conifer"
    ),
    
    "Quercus leucotrichophora": SpeciesTraits(
        species_name="Quercus leucotrichophora",
        common_name="Banj Oak",
        Hm=25.0,
        rho=720,
        a=38.0,
        c=280,
        zeta=0.30,
        k_growth=0.04,
        D_max=0.8,
        bef=1.35,
        rotation_age=80,
        forest_type="Himalayan Broadleaf"
    ),
}


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def create_planting_from_dict(data: dict) -> PlantingRecord:
    """Create a PlantingRecord from a dictionary."""
    planting_date = data.get('planting_date')
    if isinstance(planting_date, str):
        planting_date = datetime.strptime(planting_date, '%Y-%m-%d')
    
    return PlantingRecord(
        species_name=data['species_name'],
        quantity=data['quantity'],
        planting_date=planting_date,
        location=data.get('location'),
        latitude=data.get('latitude'),
        longitude=data.get('longitude'),
        spacing_m=data.get('spacing_m', 3.0)
    )


def load_plantings_from_csv(filepath: str) -> List[PlantingRecord]:
    """
    Load planting records from a CSV file.
    
    Expected columns:
    - species_name: Scientific name of the species
    - quantity: Number of trees
    - planting_date: Date in YYYY-MM-DD format
    - location (optional): Location name
    - latitude (optional): Latitude
    - longitude (optional): Longitude
    - spacing_m (optional): Spacing in meters
    """
    df = pd.read_csv(filepath)
    plantings = []
    
    for _, row in df.iterrows():
        plantings.append(create_planting_from_dict(row.to_dict()))
    
    return plantings


def export_results_to_csv(df: pd.DataFrame, filepath: str):
    """Export projection results to CSV."""
    df.to_csv(filepath, index=False)
    print(f"Results exported to {filepath}")


def print_species_info(model: CarbonStockModel):
    """Print information about available species."""
    print("\n" + "="*80)
    print("AVAILABLE SPECIES IN DATABASE")
    print("="*80)
    
    for name, traits in model.species_db.items():
        print(f"\n{traits.common_name} ({name})")
        print(f"  Max Height: {traits.Hm}m | Wood Density: {traits.rho} kg/m³")
        print(f"  Root-to-Shoot: {traits.zeta} | Growth Rate: {traits.k_growth}")
        print(f"  Rotation Age: {traits.rotation_age} years | Type: {traits.forest_type}")


# =============================================================================
# MAIN EXECUTION
# =============================================================================

if __name__ == "__main__":
    # Example usage
    model = CarbonStockModel()
    
    # Print available species
    print_species_info(model)
    
    # Example: Project carbon for a Teak plantation
    print("\n" + "="*80)
    print("EXAMPLE: 1000 Teak trees planted on 2025-01-01")
    print("="*80)
    
    results = model.project_single_species(
        species_name="Tectona grandis",
        quantity=1000,
        planting_date=datetime(2025, 1, 1),
        years=40
    )
    
    # Print summary for years 1, 5, 10, 20, 30, 40
    print("\nYear | DBH(cm) | Height(m) | Survival | AGB(t) | BGB(t) | Carbon(t) | CO2eq(t)")
    print("-" * 85)
    for year in [1, 5, 10, 20, 30, 40]:
        row = results[results['year'] == year].iloc[0]
        print(f"{row['year']:4d} | {row['dbh_cm']:7.1f} | {row['height_m']:9.1f} | "
              f"{row['survival_rate']:8.1%} | {row['total_agb_tonnes']:6.1f} | "
              f"{row['total_bgb_tonnes']:6.1f} | {row['total_carbon_tonnes']:9.1f} | "
              f"{row['co2_equivalent_tonnes']:8.1f}")
