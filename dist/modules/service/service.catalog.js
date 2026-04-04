"use strict";
/**
 * Canonical service catalog (source of truth for seeding).
 * Department slugs are stable API identifiers within each service.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICE_CATALOG = void 0;
exports.SERVICE_CATALOG = [
    {
        name: "Emergency Medical Transport",
        slug: "emergency-medical-transport",
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
        name: "Non Emergency Medical Transport",
        slug: "non-emergency-medical-transport",
        departments: [
            { name: "Ground Ambulance", slug: "ground-ambulance" },
            { name: "Air Ambulance", slug: "air-ambulance" },
            {
                name: "Cargo for Remains (Local and international)",
                slug: "cargo-for-remains-local-and-international",
            },
            { name: "Hearse for remains", slug: "hearse-for-remains" },
        ],
    },
    {
        name: "Personnel",
        slug: "personnel",
        departments: [
            { name: "Ambulance Driver", slug: "ambulance-driver" },
            {
                name: "Basic Emergency Medical Technician",
                slug: "basic-emergency-medical-technician",
            },
            {
                name: "Paramedic Air/Ground Ambulance",
                slug: "paramedic-air-ground-ambulance",
            },
            { name: "Ambulance Nurse", slug: "ambulance-nurse" },
            { name: "Ambulance Doctor", slug: "ambulance-doctor" },
            { name: "Emergency Physician", slug: "emergency-physician" },
            { name: "Intensivist", slug: "intensivist" },
        ],
    },
    {
        name: "Ambulance Servicing",
        slug: "ambulance-servicing",
        departments: [
            { name: "Ambulance Sales", slug: "ambulance-sales" },
            { name: "Ambulance Maintenance", slug: "ambulance-maintenance" },
            { name: "Ambulance equipment", slug: "ambulance-equipment" },
        ],
    },
];
