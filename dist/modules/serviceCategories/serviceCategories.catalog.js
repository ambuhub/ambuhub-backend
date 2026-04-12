"use strict";
/**
 * Canonical service category catalog (source of truth for seeding).
 * Department slugs are stable API identifiers within each category.
 * Slugs align with the provider UI (medical-transport, personnel, ambulance-servicing).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICE_CATEGORY_CATALOG = void 0;
exports.SERVICE_CATEGORY_CATALOG = [
    {
        name: "Medical transport",
        slug: "medical-transport",
        departments: [
            { name: "Ground Ambulance", slug: "ground-ambulance" },
            { name: "Air Ambulance", slug: "air-ambulance" },
            {
                name: "Cargo for Remains (Local and international)",
                slug: "cargo-for-remains-local-and-international",
            },
            { name: "Hearse for remains", slug: "hearse-for-remains" },
            { name: "Community Provider", slug: "community-provider" },
        ],
    },
    {
        name: "Ambulance personnel",
        slug: "personnel",
        departments: [
            { name: "Ambulance Driver", slug: "ambulance-driver" },
            {
                name: "Basic Emergency Medical Technician",
                slug: "basic-emergency-medical-technician",
            },
            {
                name: "Paramedic (Air/Ground Ambulance)",
                slug: "ambulance-paramedic",
            },
            { name: "Ambulance Nurse", slug: "ambulance-nurse" },
            { name: "Ambulance Doctor", slug: "ambulance-doctor" },
            { name: "Emergency Physician", slug: "emergency-physician" },
            { name: "Intensivist", slug: "intensivist" },
        ],
    },
    {
        name: "Ambulance servicing",
        slug: "ambulance-servicing",
        departments: [
            { name: "Ambulance Sales", slug: "ambulance-sales" },
            { name: "Ambulance Maintenance", slug: "ambulance-maintenance" },
            { name: "Ambulance equipment", slug: "ambulance-equipment" },
        ],
    },
];
