#!/usr/bin/env python3
"""
Carbon Stock Model - Command Line Interface
============================================

Simple CLI to run carbon stock projections for tree plantations.

Usage:
    python run_model.py --interactive
    python run_model.py --csv plantings.csv --output results.csv
    python run_model.py --species "Tectona grandis" --quantity 1000 --date 2025-01-01

Author: Medius Earth
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
import numpy as np

from carbon_stock_model import (
    CarbonStockModel, 
    PlantingRecord, 
    load_plantings_from_csv,
    print_species_info
)


def interactive_mode(model: CarbonStockModel):
    """Run the model in interactive mode."""
    print("\n" + "="*70)
    print("   CARBON STOCK ASSESSMENT MODEL - Interactive Mode")
    print("="*70)
    
    # Show available species
    print("\nAvailable species:")
    species_list = model.get_available_species()
    for i, sp in enumerate(species_list, 1):
        traits = model.species_db[sp]
        print(f"  {i:2d}. {traits.common_name:25s} ({sp})")
    
    # Get user input
    print("\n" + "-"*70)
    
    while True:
        try:
            choice = input("\nEnter species number (or name), or 'q' to quit: ").strip()
            
            if choice.lower() == 'q':
                print("Goodbye!")
                return
            
            # Try to parse as number
            if choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(species_list):
                    species_name = species_list[idx]
                else:
                    print(f"Invalid number. Please enter 1-{len(species_list)}")
                    continue
            else:
                # Try to match species name
                matches = [sp for sp in species_list if choice.lower() in sp.lower()]
                if len(matches) == 1:
                    species_name = matches[0]
                elif len(matches) > 1:
                    print(f"Multiple matches: {matches}. Please be more specific.")
                    continue
                else:
                    print(f"Species '{choice}' not found.")
                    continue
            
            # Get quantity
            quantity = int(input("Enter number of trees: "))
            
            # Get planting date
            date_str = input("Enter planting date (YYYY-MM-DD) [default: 2025-01-01]: ").strip()
            if not date_str:
                date_str = "2025-01-01"
            planting_date = datetime.strptime(date_str, "%Y-%m-%d")
            
            # Get projection years
            years_str = input("Projection years [default: 40]: ").strip()
            years = int(years_str) if years_str else 40
            
            # Run projection
            print(f"\nProjecting {quantity} {species_name} trees for {years} years...")
            results = model.project_single_species(
                species_name=species_name,
                quantity=quantity,
                planting_date=planting_date,
                years=years
            )
            
            # Display results
            display_results(results, species_name, quantity)
            
            # Export option
            export = input("\nExport to CSV? (y/n) [default: n]: ").strip().lower()
            if export == 'y':
                filename = f"projection_{species_name.replace(' ', '_')}_{quantity}trees.csv"
                results.to_csv(filename, index=False)
                print(f"Results exported to {filename}")
            
        except ValueError as e:
            print(f"Invalid input: {e}")
        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            return


def display_results(df: pd.DataFrame, species_name: str, quantity: int):
    """Display projection results in a formatted table."""
    print("\n" + "="*90)
    print(f"CARBON STOCK PROJECTION: {species_name} ({quantity:,} trees)")
    print("="*90)
    
    print("\nYear | DBH(cm) | Height(m) | Surviving | AGB(t) | BGB(t) | Total(t) | Carbon(t) | CO2eq(t)")
    print("-"*95)
    
    # Show key years
    key_years = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40]
    key_years = [y for y in key_years if y <= df['year'].max()]
    
    for year in key_years:
        if year in df['year'].values:
            row = df[df['year'] == year].iloc[0]
            print(f"{row['year']:4d} | {row['dbh_cm']:7.1f} | {row['height_m']:9.1f} | "
                  f"{row['surviving_trees']:9,d} | {row['total_agb_tonnes']:6.1f} | "
                  f"{row['total_bgb_tonnes']:6.1f} | {row['total_biomass_tonnes']:8.1f} | "
                  f"{row['total_carbon_tonnes']:9.1f} | {row['co2_equivalent_tonnes']:8.1f}")
    
    # Summary statistics
    final = df.iloc[-1]
    print("\n" + "-"*95)
    print("SUMMARY AT FINAL YEAR:")
    print(f"  Total Biomass: {final['total_biomass_tonnes']:.1f} tonnes "
          f"(AGB: {final['total_agb_tonnes']:.1f}t + BGB: {final['total_bgb_tonnes']:.1f}t)")
    print(f"  Total Carbon:  {final['total_carbon_tonnes']:.1f} tonnes C")
    print(f"  CO2 Equivalent: {final['co2_equivalent_tonnes']:.1f} tonnes CO2")
    print(f"  Survival Rate: {final['survival_rate']:.1%} ({final['surviving_trees']:,} trees)")
    
    # Per-tree metrics
    print(f"\n  Per-tree at year {int(final['year'])}:")
    print(f"    DBH: {final['dbh_cm']:.1f} cm")
    print(f"    Height: {final['height_m']:.1f} m")
    print(f"    Biomass: {final['agb_kg_per_tree'] + final['bgb_kg_per_tree']:.1f} kg")


def run_from_csv(model: CarbonStockModel, csv_path: str, output_path: str, years: int):
    """Run projections from a CSV file."""
    print(f"\nLoading plantings from {csv_path}...")
    plantings = load_plantings_from_csv(csv_path)
    
    print(f"Found {len(plantings)} planting records:")
    for p in plantings:
        print(f"  - {p.species_name}: {p.quantity:,} trees ({p.planting_date.strftime('%Y-%m-%d')})")
    
    print(f"\nProjecting for {years} years...")
    summary_df, detailed_df = model.project_mixed_planting(plantings, years)
    
    # Display summary
    print("\n" + "="*80)
    print("COMBINED PROJECTION SUMMARY")
    print("="*80)
    
    print("\nYear | Trees | AGB(t) | BGB(t) | Total Biomass(t) | Carbon(t) | CO2eq(t)")
    print("-"*85)
    
    key_years = [1, 5, 10, 20, 30, 40]
    key_years = [y for y in key_years if y <= summary_df['year'].max()]
    
    for year in key_years:
        if year in summary_df['year'].values:
            row = summary_df[summary_df['year'] == year].iloc[0]
            print(f"{year:4d} | {int(row['surviving_trees']):5,d} | {row['total_agb_tonnes']:6.1f} | "
                  f"{row['total_bgb_tonnes']:6.1f} | {row['total_biomass_tonnes']:16.1f} | "
                  f"{row['total_carbon_tonnes']:9.1f} | {row['co2_equivalent_tonnes']:8.1f}")
    
    # Save outputs
    summary_output = output_path.replace('.csv', '_summary.csv')
    detailed_output = output_path.replace('.csv', '_detailed.csv')
    
    summary_df.to_csv(summary_output, index=False)
    detailed_df.to_csv(detailed_output, index=False)
    
    print(f"\nResults saved to:")
    print(f"  Summary: {summary_output}")
    print(f"  Detailed: {detailed_output}")


def run_single_species(model: CarbonStockModel, species: str, quantity: int, 
                       date_str: str, years: int, output_path: str = None):
    """Run projection for a single species from command line."""
    planting_date = datetime.strptime(date_str, "%Y-%m-%d")
    
    print(f"\nProjecting {quantity:,} {species} trees for {years} years...")
    results = model.project_single_species(
        species_name=species,
        quantity=quantity,
        planting_date=planting_date,
        years=years
    )
    
    display_results(results, species, quantity)
    
    if output_path:
        results.to_csv(output_path, index=False)
        print(f"\nResults saved to {output_path}")
    
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Carbon Stock Assessment Model for Tree Plantations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_model.py --interactive
  python run_model.py --list-species
  python run_model.py --species "Tectona grandis" --quantity 1000 --date 2025-01-01
  python run_model.py --csv plantings.csv --output results.csv
        """
    )
    
    parser.add_argument('--interactive', '-i', action='store_true',
                        help='Run in interactive mode')
    parser.add_argument('--list-species', '-l', action='store_true',
                        help='List all available species')
    parser.add_argument('--species', '-s', type=str,
                        help='Species name (scientific)')
    parser.add_argument('--quantity', '-q', type=int, default=1000,
                        help='Number of trees (default: 1000)')
    parser.add_argument('--date', '-d', type=str, default='2025-01-01',
                        help='Planting date YYYY-MM-DD (default: 2025-01-01)')
    parser.add_argument('--years', '-y', type=int, default=40,
                        help='Projection years (default: 40)')
    parser.add_argument('--csv', '-c', type=str,
                        help='Input CSV file with multiple plantings')
    parser.add_argument('--output', '-o', type=str,
                        help='Output CSV file path')
    
    args = parser.parse_args()
    
    # Initialize model
    model = CarbonStockModel()
    
    if args.list_species:
        print_species_info(model)
        return
    
    if args.interactive:
        interactive_mode(model)
        return
    
    if args.csv:
        output = args.output or 'projection_results.csv'
        run_from_csv(model, args.csv, output, args.years)
        return
    
    if args.species:
        output = args.output
        run_single_species(model, args.species, args.quantity, 
                          args.date, args.years, output)
        return
    
    # Default: interactive mode
    interactive_mode(model)


if __name__ == "__main__":
    main()
