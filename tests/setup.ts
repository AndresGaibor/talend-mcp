/**
 * Las pruebas no deben depender del Talend Studio de quien las corre: con el puente apuntando a un puerto donde no
 * escucha nadie, cualquier llamada falla al instante (y las que quieren un puente lo levantan ellas mismas).
 * Sin esto, un Studio abierto y saturado vuelve lentas o inestables pruebas que no tienen nada que ver con el.
 */
process.env.TALEND_BRIDGE_PORT ??= "1";
