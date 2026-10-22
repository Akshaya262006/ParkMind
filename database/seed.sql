-- PARKSENSE reference/prototype seed data
-- These dimensions are reference values for development.
-- They do NOT represent measurements of a real parking facility.

INSERT INTO parking_zones
    (zone_id, name, width_m, length_m, description)
VALUES
    (
        'A',
        'Prototype Zone A',
        20.0,
        30.0,
        'Configurable reference layout for the PARKSENSE prototype'
    )
ON CONFLICT (zone_id) DO NOTHING;


-- Physical prototype slots: A1, A2, A3
INSERT INTO parking_slots
    (
        slot_id,
        zone_id,
        x_m,
        y_m,
        length_m,
        width_m,
        orientation,
        status
    )
SELECT
    'A1',
    id,
    2.0,
    3.0,
    5.0,
    2.5,
    90,
    'VACANT'
FROM parking_zones
WHERE zone_id = 'A'
ON CONFLICT (slot_id) DO NOTHING;


INSERT INTO parking_slots
    (
        slot_id,
        zone_id,
        x_m,
        y_m,
        length_m,
        width_m,
        orientation,
        status
    )
SELECT
    'A2',
    id,
    8.0,
    3.0,
    5.0,
    2.5,
    90,
    'VACANT'
FROM parking_zones
WHERE zone_id = 'A'
ON CONFLICT (slot_id) DO NOTHING;


INSERT INTO parking_slots
    (
        slot_id,
        zone_id,
        x_m,
        y_m,
        length_m,
        width_m,
        orientation,
        status
    )
SELECT
    'A3',
    id,
    14.0,
    3.0,
    5.0,
    2.5,
    90,
    'VACANT'
FROM parking_zones
WHERE zone_id = 'A'
ON CONFLICT (slot_id) DO NOTHING;