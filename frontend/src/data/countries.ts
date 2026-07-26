// Catálogo de países soportados por la clínica.
// Cada país define su nombre visible y la lista de sus divisiones
// administrativas de primer nivel (departamentos o provincias).
// El código ISO alpha-2 se guarda en la base de datos.
//
// Para agregar un país nuevo: añade una entrada aquí y ya queda disponible
// en el selector — no requiere cambios en el backend.

export interface Country {
  code: string;   // ISO 3166-1 alpha-2, ej. 'HN'
  name: string;   // Nombre para mostrar
  divisionLabel: string; // Cómo se llama la división ("Departamento", "Provincia")
  divisions: readonly string[];
}

export const COUNTRIES: readonly Country[] = [
  {
    code: 'HN',
    name: 'Honduras',
    divisionLabel: 'Departamento',
    divisions: [
      'Atlántida', 'Choluteca', 'Colón', 'Comayagua', 'Copán', 'Cortés',
      'El Paraíso', 'Francisco Morazán', 'Gracias a Dios', 'Intibucá',
      'Islas de la Bahía', 'La Paz', 'Lempira', 'Ocotepeque', 'Olancho',
      'Santa Bárbara', 'Valle', 'Yoro',
    ],
  },
  {
    code: 'NI',
    name: 'Nicaragua',
    divisionLabel: 'Departamento',
    divisions: [
      'Boaco', 'Carazo', 'Chinandega', 'Chontales', 'Estelí', 'Granada',
      'Jinotega', 'León', 'Madriz', 'Managua', 'Masaya', 'Matagalpa',
      'Nueva Segovia', 'Río San Juan', 'Rivas',
      'RACCN (Caribe Norte)', 'RACCS (Caribe Sur)',
    ],
  },
  {
    code: 'GT',
    name: 'Guatemala',
    divisionLabel: 'Departamento',
    divisions: [
      'Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula',
      'El Progreso', 'Escuintla', 'Guatemala', 'Huehuetenango', 'Izabal',
      'Jalapa', 'Jutiapa', 'Petén', 'Quetzaltenango', 'Quiché', 'Retalhuleu',
      'Sacatepéquez', 'San Marcos', 'Santa Rosa', 'Sololá', 'Suchitepéquez',
      'Totonicapán', 'Zacapa',
    ],
  },
  {
    code: 'SV',
    name: 'El Salvador',
    divisionLabel: 'Departamento',
    divisions: [
      'Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán', 'La Libertad',
      'La Paz', 'La Unión', 'Morazán', 'San Miguel', 'San Salvador',
      'San Vicente', 'Santa Ana', 'Sonsonate', 'Usulután',
    ],
  },
  {
    code: 'CR',
    name: 'Costa Rica',
    divisionLabel: 'Provincia',
    divisions: [
      'Alajuela', 'Cartago', 'Guanacaste', 'Heredia', 'Limón',
      'Puntarenas', 'San José',
    ],
  },
];

export function findCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find(c => c.code === code.toUpperCase());
}
