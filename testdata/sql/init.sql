-- Carga inicial para las pruebas del MCP de Talend.
CREATE TABLE IF NOT EXISTS clientes (
  id            integer PRIMARY KEY,
  nombre        varchar(120),
  fecha_alta    date,
  monto         numeric(12,2),
  estado        varchar(20),
  ciudad        varchar(60)
);

CREATE TABLE IF NOT EXISTS transacciones (
  id_tx        varchar(20) PRIMARY KEY,
  id_cliente   integer NOT NULL REFERENCES clientes(id),
  monto        numeric(12,2) NOT NULL,
  fecha        date NOT NULL
);

INSERT INTO clientes (id, nombre, fecha_alta, monto, estado, ciudad) VALUES
  (1, 'Ana María Núñez', '2023-01-15', 1500.50, 'ACTIVO', 'Bogotá'),
  (2, 'José Cañizares', '2023-01-15', 2300.00, 'ACTIVO', 'Medellín'),
  (3, 'Lucía Peña', '2023-02-01', NULL, 'INACTIVO', 'Cali'),
  (4, 'Pedro Ñoño', '2023-02-01', 875.25, 'ACTIVO', 'Barranquilla'),
  (5, 'María José Muñoz', '2023-03-10', 3210.75, 'SUSPENDIDO', 'Bogotá'),
  (6, 'Andrés Villalba', '2023-03-10', 999.99, 'ACTIVO', 'Cartagena'),
  (7, 'Camila Gómez', '2023-04-01', 0.00, 'ACTIVO', 'Bucaramanga'),
  (8, '', '2023-04-15', 450.00, 'ACTIVO', 'Pereira'),
  (9, 'Tomás O''Brien', '2023-04-15', 1250.00, 'INACTIVO', 'Santa Marta'),
  (10, 'Sofía Ramírez', '2023-05-01', 750.25, 'ACTIVO', 'Bogotá');

INSERT INTO transacciones (id_tx, id_cliente, monto, fecha) VALUES
  ('T001', 1, 250.00, '2023-06-01'),
  ('T002', 2, 1300.50, '2023-06-02'),
  ('T003', 3, 99.99, '2023-06-03'),
  ('T004', 4, 4500.00, '2023-06-04'),
  ('T005', 5, 75.25, '2023-06-05'),
  ('T006', 6, 180.00, '2023-06-06'),
  ('T007', 7, 620.10, '2023-06-07'),
  ('T008', 999, 300.00, '2023-06-08'),
  ('T009', 10, 45.99, '2023-06-09'),
  ('T010', 8, 1200.00, '2023-06-10');
