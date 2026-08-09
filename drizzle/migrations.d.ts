/**
 * Type declaration for the `migrations.js` bundle emitted by `drizzle-kit generate`.
 * The generated file is plain JavaScript, so its shape is declared here to keep
 * the migration call site fully typed.
 */
declare const migrations: {
  journal: {
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
  };
  migrations: Record<string, string>;
};

export default migrations;
