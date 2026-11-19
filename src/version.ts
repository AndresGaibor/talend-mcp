import pkg from "../package.json";

/** Version unica: la que declara package.json (el release, el plugin y el manifiesto la repiten y un test las compara). */
export const VERSION: string = pkg.version;
