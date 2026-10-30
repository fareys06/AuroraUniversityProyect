
"use strict";

/* =========================================================
   AURORA UNIVERSITY
   ARCHIVO PRINCIPAL: js/app.js
   Registro, inicio de sesión, IndexedDB y funciones generales
========================================================= */

/* =========================================================
   1. CONFIGURACIÓN GENERAL
========================================================= */

const AURORA_CONFIG = {
    nombreBD: "AuroraUniversityDB",
    versionBD: 1,
    tiendaUsuarios: "usuarios",
    correoAdmin: "admin@aurora.edu",
    claveAdmin: "2026",
    sesionKey: "auroraSesion"
};

let auroraDB = null;

/* =========================================================
   2. FUNCIONES GENERALES
========================================================= */

function auroraGenerarId() {
    return "AURORA-" + Date.now() + "-" +
        Math.random().toString(36).substring(2, 9);
}

function auroraNormalizarCorreo(correo) {
    return String(correo || "").trim().toLowerCase();
}

function auroraMostrarMensaje(mensaje, tipo = "info") {
    let contenedor = document.getElementById("aurora-mensaje");

    if (!contenedor) {
        contenedor = document.createElement("div");
        contenedor.id = "aurora-mensaje";

        Object.assign(contenedor.style, {
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: "999999",
            padding: "15px 22px",
            borderRadius: "10px",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: "600",
            boxShadow: "0 5px 20px rgba(0,0,0,.2)",
            maxWidth: "350px",
            transition: "opacity .3s"
        });

        document.body.appendChild(contenedor);
    }

    const colores = {
        success: "#198754",
        error: "#dc3545",
        warning: "#d69e00",
        info: "#173b68"
    };

    contenedor.style.background = colores[tipo] || colores.info;
    contenedor.textContent = mensaje;
    contenedor.style.opacity = "1";

    clearTimeout(contenedor._timer);

    contenedor._timer = setTimeout(() => {
        contenedor.style.opacity = "0";
    }, 4000);
}

function auroraObtenerCampo(formulario, nombres) {
    if (!formulario) return "";

    const elementos = Array.from(formulario.elements || []);

    for (const nombre of nombres) {
        const campo = elementos.find(elemento =>
            elemento.id?.toLowerCase() === nombre.toLowerCase() ||
            elemento.name?.toLowerCase() === nombre.toLowerCase()
        );

        if (campo) {
            return String(campo.value || "").trim();
        }
    }

    return "";
}

function auroraBuscarCampoGlobal(nombres) {
    for (const nombre of nombres) {
        const campo = document.getElementById(nombre) ||
            document.querySelector(`[name="${nombre}"]`);

        if (campo) {
            return String(campo.value || "").trim();
        }
    }

    return "";
}

function auroraValorCampo(campo) {
    return campo ? String(campo.value || "").trim() : "";
}

/* =========================================================
   3. CONTRASEÑAS Y HASH
========================================================= */

function auroraCrearSalt() {
    if (window.crypto && crypto.getRandomValues) {
        const valores = new Uint8Array(16);
        crypto.getRandomValues(valores);

        return Array.from(valores)
            .map(valor => valor.toString(16).padStart(2, "0"))
            .join("");
    }

    return Math.random().toString(36).substring(2) +
        Date.now().toString(36);
}

async function auroraHashPassword(password, salt = "") {
    const texto = salt + String(password);

    if (window.crypto && window.crypto.subtle) {
        const datos = new TextEncoder().encode(texto);
        const resultado = await crypto.subtle.digest("SHA-256", datos);

        return Array.from(new Uint8Array(resultado))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    let hash = 0;

    for (let i = 0; i < texto.length; i++) {
        hash = ((hash << 5) - hash) + texto.charCodeAt(i);
        hash |= 0;
    }

    return "fallback-" + Math.abs(hash).toString(16);
}

/* =========================================================
   4. CONEXIÓN CON INDEXEDDB
========================================================= */

function auroraAbrirBD() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("Tu navegador no permite IndexedDB."));
            return;
        }

        const solicitud = indexedDB.open(
            AURORA_CONFIG.nombreBD,
            AURORA_CONFIG.versionBD
        );

        solicitud.onupgradeneeded = function (evento) {
            const db = evento.target.result;
            let usuarios;

            if (!db.objectStoreNames.contains(
                AURORA_CONFIG.tiendaUsuarios
            )) {
                usuarios = db.createObjectStore(
                    AURORA_CONFIG.tiendaUsuarios,
                    { keyPath: "id" }
                );
            } else {
                usuarios = evento.target.transaction.objectStore(
                    AURORA_CONFIG.tiendaUsuarios
                );
            }

            if (!usuarios.indexNames.contains("correo")) {
                usuarios.createIndex("correo", "correo", {
                    unique: true
                });
            }

            if (!usuarios.indexNames.contains("rol")) {
                usuarios.createIndex("rol", "rol", {
                    unique: false
                });
            }
        };

        solicitud.onsuccess = function (evento) {
            auroraDB = evento.target.result;

            auroraDB.onversionchange = function () {
                auroraDB.close();
            };

            resolve(auroraDB);
        };

        solicitud.onerror = function () {
            reject(solicitud.error);
        };

        solicitud.onblocked = function () {
            console.warn("La base de datos está bloqueada por otra pestaña.");
        };
    });
}

/* =========================================================
   5. OPERACIONES DE USUARIOS
========================================================= */

function auroraGuardarRegistro(usuario) {
    return new Promise((resolve, reject) => {
        const transaccion = auroraDB.transaction(
            AURORA_CONFIG.tiendaUsuarios,
            "readwrite"
        );

        const tienda = transaccion.objectStore(
            AURORA_CONFIG.tiendaUsuarios
        );

        const solicitud = tienda.put(usuario);

        solicitud.onsuccess = () => resolve(usuario);
        solicitud.onerror = () => reject(solicitud.error);
    });
}

function auroraBuscarUsuario(correo) {
    return new Promise((resolve, reject) => {
        const transaccion = auroraDB.transaction(
            AURORA_CONFIG.tiendaUsuarios,
            "readonly"
        );

        const tienda = transaccion.objectStore(
            AURORA_CONFIG.tiendaUsuarios
        );

        const solicitud = tienda.index("correo").get(
            auroraNormalizarCorreo(correo)
        );

        solicitud.onsuccess = () => resolve(solicitud.result || null);
        solicitud.onerror = () => reject(solicitud.error);
    });
}

function auroraObtenerTodosLosUsuarios() {
    return new Promise((resolve, reject) => {
        const transaccion = auroraDB.transaction(
            AURORA_CONFIG.tiendaUsuarios,
            "readonly"
        );

        const tienda = transaccion.objectStore(
            AURORA_CONFIG.tiendaUsuarios
        );

        const solicitud = tienda.getAll();

        solicitud.onsuccess = () => resolve(solicitud.result || []);
        solicitud.onerror = () => reject(solicitud.error);
    });
}

function auroraEliminarUsuarioBD(id) {
    return new Promise((resolve, reject) => {
        const transaccion = auroraDB.transaction(
            AURORA_CONFIG.tiendaUsuarios,
            "readwrite"
        );

        const tienda = transaccion.objectStore(
            AURORA_CONFIG.tiendaUsuarios
        );

        const solicitud = tienda.delete(id);

        solicitud.onsuccess = () => resolve(true);
        solicitud.onerror = () => reject(solicitud.error);
    });
}

/* =========================================================
   6. ADMINISTRADOR
========================================================= */

async function auroraInicializarAdministrador() {
    const correo = AURORA_CONFIG.correoAdmin;
    const password = AURORA_CONFIG.claveAdmin;

    let administrador = await auroraBuscarUsuario(correo);

    const salt = administrador?.salt || auroraCrearSalt();
    const hash = await auroraHashPassword(password, salt);

    if (!administrador) {
        administrador = {
            id: auroraGenerarId(),
            nombre: "Administrador",
            apellido: "Aurora",
            correo,
            password: hash,
            salt,
            rol: "admin",
            facultad: "Administración",
            carrera: "Administración del sistema",
            descripcion: "Administrador de Aurora University",
            fechaRegistro: new Date().toISOString()
        };
    } else {
        administrador.password = hash;
        administrador.salt = salt;
        administrador.rol = "admin";
    }

    await auroraGuardarRegistro(administrador);
}

/* =========================================================
   7. MIGRAR USUARIOS ANTERIORES
========================================================= */

async function auroraMigrarUsuariosAnteriores() {
    const claves = [
        "aurora_users",
        "auroraUsuarios",
        "usuariosAurora"
    ];

    for (const clave of claves) {
        const contenido = localStorage.getItem(clave);

        if (!contenido) continue;

        try {
            const usuarios = JSON.parse(contenido);

            if (!Array.isArray(usuarios)) continue;

            for (const anterior of usuarios) {
                const correo = auroraNormalizarCorreo(
                    anterior.correo || anterior.email
                );

                if (!correo || correo === AURORA_CONFIG.correoAdmin) {
                    continue;
                }

                const existente = await auroraBuscarUsuario(correo);

                if (existente) continue;

                const passwordAnterior =
                    anterior.password || anterior.contrasena;

                if (!passwordAnterior) continue;

                const salt = anterior.salt || auroraCrearSalt();

                const usuario = {
                    id: anterior.id || auroraGenerarId(),
                    nombre: anterior.nombre ||
                        anterior.nombres || "",
                    apellido: anterior.apellido ||
                        anterior.apellidos || "",
                    correo,
                    password: await auroraHashPassword(
                        passwordAnterior,
                        salt
                    ),
                    salt,
                    rol: "estudiante",
                    facultad: anterior.facultad || "",
                    carrera: anterior.carrera || "",
                    descripcion: anterior.descripcion || "",
                    fechaRegistro: anterior.fechaRegistro ||
                        new Date().toISOString()
                };

                await auroraGuardarRegistro(usuario);
            }
        } catch (error) {
            console.warn("Error al migrar usuarios:", error);
        }
    }
}

/* =========================================================
   8. REGISTRAR ESTUDIANTE
========================================================= */

async function auroraRegistrarUsuario(datos) {
    const correo = auroraNormalizarCorreo(datos.correo);

    if (!datos.nombre || !correo || !datos.password) {
        throw new Error("Completa los campos obligatorios.");
    }

    if (correo === AURORA_CONFIG.correoAdmin) {
        throw new Error("Este correo está reservado para administración.");
    }

    if (datos.password.length < 4) {
        throw new Error("La contraseña debe tener al menos 4 caracteres.");
    }

    const existente = await auroraBuscarUsuario(correo);

    if (existente) {
        throw new Error("Este correo ya está registrado.");
    }

    const salt = auroraCrearSalt();
    const hash = await auroraHashPassword(datos.password, salt);

    const usuario = {
        id: auroraGenerarId(),
        nombre: datos.nombre,
        apellido: datos.apellido || "",
        correo,
        password: hash,
        salt,
        rol: "estudiante",
        facultad: datos.facultad || "",
        carrera: datos.carrera || "",
        descripcion: datos.descripcion || "",
        fechaRegistro: new Date().toISOString()
    };

    await auroraGuardarRegistro(usuario);

    return usuario;
}

/* =========================================================
   9. DETECCIÓN INTELIGENTE DE CAMPOS DEL REGISTRO
========================================================= */

function auroraBuscarCampoRegistro(formulario, aliases) {
    if (!formulario) return null;

    const elementos = Array.from(formulario.elements || []);

    // Coincidencia exacta de ID o NAME.
    for (const alias of aliases) {
        const encontrado = elementos.find(campo =>
            (campo.id || "").toLowerCase() === alias.toLowerCase() ||
            (campo.name || "").toLowerCase() === alias.toLowerCase()
        );

        if (encontrado) return encontrado;
    }

    // Coincidencia parcial de ID o NAME.
    for (const alias of aliases) {
        const encontrado = elementos.find(campo => {
            const id = (campo.id || "").toLowerCase();
            const name = (campo.name || "").toLowerCase();

            return id.includes(alias.toLowerCase()) ||
                name.includes(alias.toLowerCase());
        });

        if (encontrado) return encontrado;
    }

    return null;
}

function auroraBuscarPorEtiqueta(formulario, palabras) {
    const etiquetas = Array.from(
        formulario.querySelectorAll("label")
    );

    for (const etiqueta of etiquetas) {
        const texto = etiqueta.textContent.toLowerCase();

        if (palabras.some(palabra =>
            texto.includes(palabra.toLowerCase())
        )) {
            const id = etiqueta.htmlFor;

            if (id) {
                const campo = document.getElementById(id);
                if (campo && formulario.contains(campo)) return campo;
            }

            const campoInterno = etiqueta.querySelector("input, select, textarea");

            if (campoInterno) return campoInterno;

            const siguiente = etiqueta.nextElementSibling;

            if (
                siguiente &&
                ["INPUT", "SELECT", "TEXTAREA"].includes(siguiente.tagName)
            ) {
                return siguiente;
            }
        }
    }

    return null;
}

function auroraObtenerCampoPorTipo(formulario, selector, posicion = 0) {
    const campos = Array.from(formulario.querySelectorAll(selector));
    return campos[posicion] || null;
}

function auroraObtenerDatosRegistro(formulario) {
    const campoNombre =
        auroraBuscarCampoRegistro(formulario, [
            "nombreCompleto",
            "nombrecompleto",
            "nombre",
            "nombres",
            "registroNombre",
            "nombreUsuario",
            "txtNombre"
        ]) ||
        auroraBuscarPorEtiqueta(formulario, ["nombre completo", "nombre"]) ||
        auroraObtenerCampoPorTipo(
            formulario,
            'input:not([type="email"]):not([type="password"]):not([type="hidden"])',
            0
        );

    const campoCorreo =
        auroraBuscarCampoRegistro(formulario, [
            "correoElectronico",
            "correo",
            "email",
            "registroCorreo",
            "correoUsuario",
            "txtCorreo"
        ]) ||
        auroraBuscarPorEtiqueta(formulario, ["correo", "email"]) ||
        auroraObtenerCampoPorTipo(formulario, 'input[type="email"]', 0);

    const campoFacultad =
        auroraBuscarCampoRegistro(formulario, [
            "facultad",
            "registroFacultad",
            "selectFacultad"
        ]) ||
        auroraBuscarPorEtiqueta(formulario, ["facultad"]) ||
        auroraObtenerCampoPorTipo(formulario, "select", 0);

    const campoCarrera =
        auroraBuscarCampoRegistro(formulario, [
            "carrera",
            "registroCarrera",
            "selectCarrera"
        ]) ||
        auroraBuscarPorEtiqueta(formulario, ["carrera"]) ||
        auroraObtenerCampoPorTipo(formulario, "select", 1);

    const campoDescripcion =
        auroraBuscarCampoRegistro(formulario, [
            "descripcion",
            "descripcionPerfil",
            "registroDescripcion",
            "biografia"
        ]) ||
        auroraBuscarPorEtiqueta(formulario, ["descripción", "descripcion"]) ||
        auroraObtenerCampoPorTipo(formulario, "textarea", 0);

    const campoPassword =
        auroraBuscarCampoRegistro(formulario, [
            "password",
            "contrasena",
            "contraseña",
            "registroPassword",
            "clave",
            "txtPassword"
        ]) ||
        auroraObtenerCampoPorTipo(
            formulario,
            'input[type="password"]',
            0
        );

    const campoConfirmacion =
        auroraBuscarCampoRegistro(formulario, [
            "confirmarPassword",
            "confirmarContrasena",
            "confirmarContraseña",
            "confirmPassword",
            "passwordConfirm",
            "confirmarClave"
        ]) ||
        auroraBuscarPorEtiqueta(formulario, [
            "confirmar contraseña",
            "confirmar contrasena"
        ]) ||
        auroraObtenerCampoPorTipo(
            formulario,
            'input[type="password"]',
            1
        );

    return {
        nombre: auroraValorCampo(campoNombre),
        correo: auroraValorCampo(campoCorreo),
        facultad: auroraValorCampo(campoFacultad),
        carrera: auroraValorCampo(campoCarrera),
        descripcion: auroraValorCampo(campoDescripcion),
        password: auroraValorCampo(campoPassword),
        confirmacion: auroraValorCampo(campoConfirmacion)
    };
}

/* =========================================================
   10. PROCESAR REGISTRO
========================================================= */

async function auroraProcesarRegistro(evento) {
    if (evento) evento.preventDefault();

    const formulario = evento?.currentTarget;

    try {
        if (!formulario || formulario.tagName !== "FORM") {
            throw new Error("No se encontró el formulario de registro.");
        }

        const datos = auroraObtenerDatosRegistro(formulario);

        console.log("Datos detectados del registro:", {
            nombre: datos.nombre,
            correo: datos.correo,
            facultad: datos.facultad,
            carrera: datos.carrera,
            passwordEncontrada: Boolean(datos.password),
            confirmacionEncontrada: Boolean(datos.confirmacion)
        });

        // Validación de campos obligatorios.
        const faltantes = [];

        if (!datos.nombre) faltantes.push("Nombre completo");
        if (!datos.correo) faltantes.push("Correo electrónico");
        if (!datos.facultad) faltantes.push("Facultad");
        if (!datos.carrera) faltantes.push("Carrera");
        if (!datos.password) faltantes.push("Contraseña");
        if (!datos.confirmacion) faltantes.push("Confirmar contraseña");

        if (faltantes.length > 0) {
            throw new Error(
                "Completa los siguientes campos: " +
                faltantes.join(", ")
            );
        }

        // Validar correo.
        const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        datos.correo = auroraNormalizarCorreo(datos.correo);

        if (!formatoCorreo.test(datos.correo)) {
            throw new Error("Ingresa un correo electrónico válido.");
        }

        // Validar contraseña.
        if (datos.password.length < 4) {
            throw new Error(
                "La contraseña debe tener al menos 4 caracteres."
            );
        }

        if (datos.password !== datos.confirmacion) {
            throw new Error("Las contraseñas no coinciden.");
        }

        // El nombre completo se guarda en el campo nombre.
        // El apellido queda vacío para conservar la estructura anterior.
        const nuevoUsuario = {
            nombre: datos.nombre,
            apellido: "",
            correo: datos.correo,
            password: datos.password,
            facultad: datos.facultad,
            carrera: datos.carrera,
            descripcion: datos.descripcion
        };

        await auroraRegistrarUsuario(nuevoUsuario);

        auroraMostrarMensaje(
            "¡Cuenta creada exitosamente! Ya puedes iniciar sesión.",
            "success"
        );

        formulario.reset();

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);

    } catch (error) {
        console.error("Error al procesar el registro:", error);

        auroraMostrarMensaje(
            error.message || "No se pudo crear la cuenta.",
            "error"
        );
    }
}

/* =========================================================
   11. INICIAR SESIÓN
========================================================= */

async function auroraIniciarSesion(correo, password) {
    correo = auroraNormalizarCorreo(correo);

    if (!correo || !password) {
        throw new Error("Ingresa tu correo y contraseña.");
    }

    const usuario = await auroraBuscarUsuario(correo);

    if (!usuario) {
        throw new Error("El correo o la contraseña son incorrectos.");
    }

    const hash = await auroraHashPassword(
        password,
        usuario.salt || ""
    );

    if (hash !== usuario.password) {
        throw new Error("El correo o la contraseña son incorrectos.");
    }

    const sesion = {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        facultad: usuario.facultad,
        carrera: usuario.carrera,
        descripcion: usuario.descripcion
    };

    sessionStorage.setItem(
        AURORA_CONFIG.sesionKey,
        JSON.stringify(sesion)
    );

    localStorage.setItem(
        "aurora_session",
        JSON.stringify(sesion)
    );

    localStorage.setItem(
        "auroraSesion",
        JSON.stringify(sesion)
    );

    return sesion;
}

async function auroraProcesarLogin(evento) {
    if (evento) evento.preventDefault();

    try {
        const formulario = evento?.currentTarget;

        const campoCorreo = formulario
            ? auroraBuscarCampoRegistro(formulario, [
                "correo", "email", "loginCorreo", "txtCorreo"
            ]) || auroraObtenerCampoPorTipo(
                formulario,
                'input[type="email"]',
                0
            )
            : null;

        const campoPassword = formulario
            ? auroraBuscarCampoRegistro(formulario, [
                "password", "contrasena", "loginPassword",
                "clave", "txtPassword"
            ]) || auroraObtenerCampoPorTipo(
                formulario,
                'input[type="password"]',
                0
            )
            : null;

        const correo = formulario
            ? auroraValorCampo(campoCorreo)
            : auroraBuscarCampoGlobal(["correo", "email", "loginCorreo"]);

        const password = formulario
            ? auroraValorCampo(campoPassword)
            : auroraBuscarCampoGlobal([
                "password", "contrasena", "loginPassword", "clave"
            ]);

        const sesion = await auroraIniciarSesion(correo, password);

        auroraMostrarMensaje(
            "Bienvenido a Aurora University.",
            "success"
        );

        setTimeout(() => {
            window.location.href = sesion.rol === "admin"
                ? "administracion.html"
                : "portal.html";
        }, 800);

    } catch (error) {
        console.error("Error de inicio de sesión:", error);
        auroraMostrarMensaje(error.message, "error");
    }
}

/* =========================================================
   12. SESIONES Y PROTECCIÓN
========================================================= */

function auroraObtenerSesion() {
    const claves = [
        AURORA_CONFIG.sesionKey,
        "aurora_session",
        "auroraSesion"
    ];

    for (const clave of claves) {
        const contenido =
            sessionStorage.getItem(clave) ||
            localStorage.getItem(clave);

        if (contenido) {
            try {
                return JSON.parse(contenido);
            } catch (error) {
                console.warn("Sesión no válida.");
            }
        }
    }

    return null;
}

function auroraCerrarSesion() {
    sessionStorage.removeItem(AURORA_CONFIG.sesionKey);
    localStorage.removeItem("aurora_session");
    localStorage.removeItem("auroraSesion");

    window.location.href = "login.html";
}

function auroraProtegerPagina() {
    const sesion = auroraObtenerSesion();

    if (!sesion) {
        window.location.href = "login.html";
        return false;
    }

    if (
        window.location.pathname.toLowerCase().includes("administracion") &&
        sesion.rol !== "admin"
    ) {
        window.location.href = "portal.html";
        return false;
    }

    return true;
}

function auroraSoloAdministrador() {
    const sesion = auroraObtenerSesion();

    if (!sesion || sesion.rol !== "admin") {
        window.location.href = "login.html";
        return false;
    }

    return true;
}

/* =========================================================
   13. MOSTRAR INFORMACIÓN DEL USUARIO
========================================================= */

function auroraMostrarDatosUsuario() {
    const sesion = auroraObtenerSesion();

    if (!sesion) return;

    const nombreCompleto =
        `${sesion.nombre || ""} ${sesion.apellido || ""}`.trim();

    const campos = {
        "#nombreUsuario": nombreCompleto,
        "#nombreEstudiante": nombreCompleto,
        "#usuarioNombre": nombreCompleto,
        "#correoUsuario": sesion.correo,
        "#emailUsuario": sesion.correo,
        "#usuarioCorreo": sesion.correo,
        "#facultadUsuario": sesion.facultad,
        "#usuarioFacultad": sesion.facultad,
        "#carreraUsuario": sesion.carrera,
        "#usuarioCarrera": sesion.carrera,
        "#descripcionUsuario": sesion.descripcion
    };

    Object.entries(campos).forEach(([selector, valor]) => {
        const elemento = document.querySelector(selector);

        if (elemento) {
            elemento.textContent = valor || "";
        }
    });
}

/* =========================================================
   14. OBJETO AURORADB
========================================================= */

window.AuroraDB = {
    inicializar: async function () {
        await auroraAbrirBD();
        await auroraMigrarUsuariosAnteriores();
        await auroraInicializarAdministrador();
        return true;
    },

    registrar: async function (datos) {
        return await auroraRegistrarUsuario(datos);
    },

    iniciarSesion: async function (correo, password) {
        return await auroraIniciarSesion(correo, password);
    },

    obtenerSesion: function () {
        return auroraObtenerSesion();
    },

    cerrarSesion: function () {
        auroraCerrarSesion();
    },

    obtenerUsuarios: async function () {
        return await auroraObtenerTodosLosUsuarios();
    },

    obtenerUsuario: async function (id) {
        const usuarios = await auroraObtenerTodosLosUsuarios();

        return usuarios.find(usuario => usuario.id === id) || null;
    },

    buscarPorCorreo: async function (correo) {
        return await auroraBuscarUsuario(correo);
    },

    eliminarUsuario: async function (id) {
        const sesion = auroraObtenerSesion();

        if (!sesion || sesion.rol !== "admin") {
            throw new Error("No tienes permisos para realizar esta acción.");
        }

        const usuario = await this.obtenerUsuario(id);

        if (!usuario) {
            throw new Error("No se encontró el usuario.");
        }

        if (usuario.rol === "admin") {
            throw new Error("No puedes eliminar al administrador.");
        }

        return await auroraEliminarUsuarioBD(id);
    }
};

/* =========================================================
   15. ADMINISTRACIÓN DE USUARIOS
========================================================= */

async function auroraCargarUsuariosAdmin() {
    if (!auroraSoloAdministrador()) return;

    const tabla = document.querySelector(
        "#tablaUsuarios tbody, #usuariosTabla tbody, #listaUsuarios"
    );

    const usuarios = await auroraObtenerTodosLosUsuarios();

    if (tabla) {
        tabla.innerHTML = "";

        usuarios.forEach(usuario => {
            const fila = document.createElement("tr");

            const nombreCompleto =
                `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim();

            [
                nombreCompleto,
                usuario.correo,
                usuario.facultad,
                usuario.carrera,
                usuario.rol
            ].forEach(valor => {
                const celda = document.createElement("td");
                celda.textContent = valor || "";
                fila.appendChild(celda);
            });

            if (usuario.rol !== "admin") {
                const celda = document.createElement("td");
                const boton = document.createElement("button");

                boton.textContent = "Eliminar";
                boton.type = "button";
                boton.className = "btn-eliminar";

                boton.addEventListener("click", async () => {
                    if (!confirm("¿Deseas eliminar este usuario?")) return;

                    try {
                        await auroraEliminarUsuarioBD(usuario.id);

                        auroraMostrarMensaje(
                            "Usuario eliminado correctamente.",
                            "success"
                        );

                        auroraCargarUsuariosAdmin();

                    } catch (error) {
                        auroraMostrarMensaje(error.message, "error");
                    }
                });

                celda.appendChild(boton);
                fila.appendChild(celda);
            }

            tabla.appendChild(fila);
        });
    }

    auroraActualizarEstadisticasAdmin(usuarios);
}

function auroraActualizarEstadisticasAdmin(usuarios) {
    const estudiantes = usuarios.filter(u => u.rol !== "admin");
    const administradores = usuarios.filter(u => u.rol === "admin");

    const total = document.querySelector("#totalUsuarios");
    const totalEstudiantes = document.querySelector("#totalEstudiantes");
    const totalAdministradores = document.querySelector("#totalAdministradores");

    if (total) total.textContent = usuarios.length;
    if (totalEstudiantes) totalEstudiantes.textContent = estudiantes.length;

    if (totalAdministradores) {
        totalAdministradores.textContent = administradores.length;
    }
}

async function auroraFiltrarUsuarios() {
    const busqueda = (
        document.querySelector("#buscarUsuario")?.value || ""
    ).toLowerCase();

    const filtro = (
        document.querySelector("#filtroFacultad")?.value || ""
    ).toLowerCase();

    const usuarios = await auroraObtenerTodosLosUsuarios();

    const filtrados = usuarios.filter(usuario => {
        const nombre = (
            `${usuario.nombre || ""} ${usuario.apellido || ""}`
        ).toLowerCase();

        const coincideBusqueda =
            nombre.includes(busqueda) ||
            (usuario.correo || "").toLowerCase().includes(busqueda);

        const coincideFacultad =
            !filtro ||
            (usuario.facultad || "").toLowerCase() === filtro;

        return coincideBusqueda && coincideFacultad;
    });

    const tabla = document.querySelector(
        "#tablaUsuarios tbody, #usuariosTabla tbody, #listaUsuarios"
    );

    if (!tabla) return;

    tabla.innerHTML = "";

    filtrados.forEach(usuario => {
        const fila = document.createElement("tr");

        const nombreCompleto =
            `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim();

        [
            nombreCompleto,
            usuario.correo,
            usuario.facultad,
            usuario.carrera,
            usuario.rol
        ].forEach(valor => {
            const celda = document.createElement("td");
            celda.textContent = valor || "";
            fila.appendChild(celda);
        });

        tabla.appendChild(fila);
    });
}

/* =========================================================
   16. EXPORTAR USUARIOS A CSV
========================================================= */

async function auroraExportarUsuariosCSV() {
    if (!auroraSoloAdministrador()) return;

    const usuarios = await auroraObtenerTodosLosUsuarios();

    const encabezados = [
        "Nombre completo",
        "Correo",
        "Facultad",
        "Carrera",
        "Rol",
        "Fecha de registro"
    ];

    const filas = usuarios.map(usuario => [
        `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim(),
        usuario.correo,
        usuario.facultad,
        usuario.carrera,
        usuario.rol,
        usuario.fechaRegistro
    ]);

    auroraDescargarCSV(
        "usuarios_aurora.csv",
        encabezados,
        filas
    );
}

function auroraDescargarCSV(nombreArchivo, encabezados, datos) {
    const contenido = [encabezados, ...datos]
        .map(fila => fila.map(valor =>
            `"${String(valor ?? "").replace(/"/g, '""')}"`
        ).join(","))
        .join("\n");

    const blob = new Blob(
        ["\uFEFF" + contenido],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);
}

/* =========================================================
   17. MENÚ MÓVIL
========================================================= */

function auroraMenuMovil() {
    const boton = document.querySelector(
        "#menuToggle, #btnMenu, .menu-toggle"
    );

    const menu = document.querySelector(
        "#menuPrincipal, #navLinks, .nav-links"
    );

    if (!boton || !menu) return;

    boton.addEventListener("click", () => {
        menu.classList.toggle("activo");
        menu.classList.toggle("active");
    });
}

/* =========================================================
   18. COMUNIDAD: PUBLICACIONES
========================================================= */

function auroraObtenerPublicaciones() {
    try {
        return JSON.parse(
            localStorage.getItem("aurora_posts") || "[]"
        );
    } catch (error) {
        return [];
    }
}

function auroraGuardarPublicaciones(publicaciones) {
    localStorage.setItem(
        "aurora_posts",
        JSON.stringify(publicaciones)
    );
}

function auroraCrearPublicacion(texto) {
    const sesion = auroraObtenerSesion();

    if (!sesion) {
        window.location.href = "login.html";
        return;
    }

    if (!texto || !texto.trim()) {
        auroraMostrarMensaje(
            "Escribe algo antes de publicar.",
            "warning"
        );
        return;
    }

    const publicaciones = auroraObtenerPublicaciones();

    publicaciones.unshift({
        id: auroraGenerarId(),
        autor: `${sesion.nombre} ${sesion.apellido || ""}`.trim(),
        correo: sesion.correo,
        texto: texto.trim(),
        fecha: new Date().toISOString(),
        likes: [],
        comentarios: []
    });

    auroraGuardarPublicaciones(publicaciones);
    auroraMostrarPublicaciones();

    auroraMostrarMensaje(
        "Publicación compartida correctamente.",
        "success"
    );
}

function auroraDarLike(id) {
    const sesion = auroraObtenerSesion();

    if (!sesion) return;

    const publicaciones = auroraObtenerPublicaciones();
    const publicacion = publicaciones.find(p => p.id === id);

    if (!publicacion) return;

    publicacion.likes = publicacion.likes || [];

    const indice = publicacion.likes.indexOf(sesion.correo);

    if (indice >= 0) {
        publicacion.likes.splice(indice, 1);
    } else {
        publicacion.likes.push(sesion.correo);
    }

    auroraGuardarPublicaciones(publicaciones);
    auroraMostrarPublicaciones();
}

function auroraMostrarPublicaciones() {
    const contenedor = document.querySelector(
        "#publicaciones, #listaPublicaciones, #feed"
    );

    if (!contenedor) return;

    const publicaciones = auroraObtenerPublicaciones();
    const sesion = auroraObtenerSesion();

    contenedor.innerHTML = "";

    publicaciones.forEach(publicacion => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "publicacion";

        const autor = document.createElement("h3");
        autor.textContent = publicacion.autor;

        const texto = document.createElement("p");
        texto.textContent = publicacion.texto;

        const fecha = document.createElement("small");
        fecha.textContent = new Date(
            publicacion.fecha
        ).toLocaleString();

        const botonLike = document.createElement("button");
        botonLike.type = "button";
        botonLike.textContent =
            `Me gusta (${(publicacion.likes || []).length})`;

        botonLike.addEventListener("click", () => {
            auroraDarLike(publicacion.id);
        });

        tarjeta.append(autor, texto, fecha, botonLike);

        const comentarios = document.createElement("div");
        comentarios.className = "comentarios";

        (publicacion.comentarios || []).forEach(comentario => {
            const linea = document.createElement("p");
            linea.textContent =
                `${comentario.autor}: ${comentario.texto}`;

            comentarios.appendChild(linea);
        });

        tarjeta.appendChild(comentarios);

        if (sesion) {
            const entrada = document.createElement("input");
            entrada.type = "text";
            entrada.placeholder = "Escribe un comentario...";

            const botonComentar = document.createElement("button");
            botonComentar.type = "button";
            botonComentar.textContent = "Comentar";

            botonComentar.addEventListener("click", () => {
                auroraComentar(publicacion.id, entrada.value);
            });

            tarjeta.append(entrada, botonComentar);
        }

        if (sesion && sesion.correo === publicacion.correo) {
            const eliminar = document.createElement("button");
            eliminar.type = "button";
            eliminar.textContent = "Eliminar publicación";

            eliminar.addEventListener("click", () => {
                const nuevas = auroraObtenerPublicaciones()
                    .filter(p => p.id !== publicacion.id);

                auroraGuardarPublicaciones(nuevas);
                auroraMostrarPublicaciones();
            });

            tarjeta.appendChild(eliminar);
        }

        contenedor.appendChild(tarjeta);
    });
}

function auroraComentar(id, comentario) {
    const sesion = auroraObtenerSesion();

    if (!sesion || !comentario || !comentario.trim()) {
        auroraMostrarMensaje(
            "Escribe un comentario antes de enviarlo.",
            "warning"
        );
        return;
    }

    const publicaciones = auroraObtenerPublicaciones();
    const publicacion = publicaciones.find(p => p.id === id);

    if (!publicacion) return;

    publicacion.comentarios = publicacion.comentarios || [];

    publicacion.comentarios.push({
        autor: `${sesion.nombre} ${sesion.apellido || ""}`.trim(),
        texto: comentario.trim(),
        fecha: new Date().toISOString()
    });

    auroraGuardarPublicaciones(publicaciones);
    auroraMostrarPublicaciones();
}

/* =========================================================
   19. PAGOS DE DEMOSTRACIÓN
========================================================= */

function auroraRegistrarPago(datos) {
    const sesion = auroraObtenerSesion();

    if (!sesion) {
        window.location.href = "login.html";
        return;
    }

    const pagos = JSON.parse(
        localStorage.getItem("aurora_receipts") || "[]"
    );

    const pago = {
        id: "PAGO-" + Date.now(),
        estudiante: `${sesion.nombre} ${sesion.apellido || ""}`.trim(),
        correo: sesion.correo,
        concepto: datos.concepto || "Pago universitario",
        monto: Number(datos.monto) || 0,
        fecha: new Date().toISOString(),
        estado: "Registrado (demostración)"
    };

    pagos.push(pago);

    localStorage.setItem(
        "aurora_receipts",
        JSON.stringify(pagos)
    );

    auroraMostrarMensaje(
        "El pago de demostración fue registrado.",
        "success"
    );

    return pago;
}

function auroraObtenerPagosUsuario() {
    const sesion = auroraObtenerSesion();

    if (!sesion) return [];

    const pagos = JSON.parse(
        localStorage.getItem("aurora_receipts") || "[]"
    );

    return pagos.filter(pago => pago.correo === sesion.correo);
}

/* =========================================================
   20. CHATBOT
========================================================= */

function auroraRespuestaChatbot(pregunta) {
    const texto = pregunta.toLowerCase();

    if (texto.includes("facultad") || texto.includes("carrera")) {
        return "Aurora University cuenta con las facultades de Medicina, Psicología, Humanidades, Ingeniería y Arquitectura.";
    }

    if (texto.includes("pago") || texto.includes("finanzas")) {
        return "Puedes consultar la sección Finanzas dentro del portal universitario para revisar la información de pagos.";
    }

    if (texto.includes("curso") || texto.includes("clase")) {
        return "En la sección Cursos puedes consultar tus asignaturas.";
    }

    if (texto.includes("tarea")) {
        return "En la sección Tareas puedes revisar las actividades y fechas de entrega.";
    }

    if (texto.includes("nota") || texto.includes("calificacion")) {
        return "Puedes consultar tus resultados en la sección Calificaciones.";
    }

    if (texto.includes("contacto") || texto.includes("ayuda")) {
        return "Puedes comunicarte con nosotros desde la página Contacto.";
    }

    if (texto.includes("hola") || texto.includes("buenas")) {
        return "¡Hola! Soy el asistente virtual de Aurora University. ¿En qué puedo ayudarte?";
    }

    return "Gracias por tu pregunta. Consulta las secciones del sitio para encontrar más información sobre Aurora University.";
}

function auroraEnviarMensajeChatbot() {
    const entrada = document.querySelector(
        "#mensajeChatbot, #chatInput, #mensajeBot"
    );

    const mensajes = document.querySelector(
        "#mensajesChatbot, #chatMessages, #conversacionBot"
    );

    if (!entrada || !mensajes || !entrada.value.trim()) return;

    const pregunta = entrada.value.trim();

    const mensajeUsuario = document.createElement("p");
    mensajeUsuario.textContent = "Tú: " + pregunta;

    mensajes.appendChild(mensajeUsuario);

    const respuesta = document.createElement("p");
    respuesta.textContent =
        "Aurora: " + auroraRespuestaChatbot(pregunta);

    mensajes.appendChild(respuesta);

    entrada.value = "";
    mensajes.scrollTop = mensajes.scrollHeight;
}

/* =========================================================
   21. FORMULARIO DE CONTACTO
========================================================= */

function auroraProcesarContacto(evento) {
    if (evento) evento.preventDefault();

    const formulario = evento?.currentTarget;

    if (!formulario) return;

    const nombre = auroraObtenerCampo(formulario, [
        "nombre", "nombreContacto"
    ]);

    const correo = auroraObtenerCampo(formulario, [
        "correo", "email", "correoContacto"
    ]);

    const mensaje = auroraObtenerCampo(formulario, [
        "mensaje", "mensajeContacto"
    ]);

    if (!nombre || !correo || !mensaje) {
        auroraMostrarMensaje(
            "Completa todos los campos del formulario.",
            "warning"
        );
        return;
    }

    const contactos = JSON.parse(
        localStorage.getItem("aurora_contactos") || "[]"
    );

    contactos.push({
        nombre,
        correo,
        mensaje,
        fecha: new Date().toISOString()
    });

    localStorage.setItem(
        "aurora_contactos",
        JSON.stringify(contactos)
    );

    auroraMostrarMensaje(
        "Tu mensaje fue registrado correctamente.",
        "success"
    );

    formulario.reset();
}

/* =========================================================
   22. FORMULARIO DE ADMISIÓN
========================================================= */

function auroraProcesarAdmision(evento) {
    if (evento) evento.preventDefault();

    const formulario = evento?.currentTarget;

    if (!formulario) return;

    const nuevaAdmision = {
        id: auroraGenerarId(),
        nombre: auroraObtenerCampo(formulario, [
            "nombre", "nombreAdmision"
        ]),
        correo: auroraObtenerCampo(formulario, [
            "correo", "email", "correoAdmision"
        ]),
        facultad: auroraObtenerCampo(formulario, [
            "facultad", "facultadAdmision"
        ]),
        carrera: auroraObtenerCampo(formulario, [
            "carrera", "carreraAdmision"
        ]),
        fecha: new Date().toISOString()
    };

    if (!nuevaAdmision.nombre || !nuevaAdmision.correo) {
        auroraMostrarMensaje(
            "Completa los datos requeridos.",
            "warning"
        );
        return;
    }

    const admisiones = JSON.parse(
        localStorage.getItem("aurora_admissions") || "[]"
    );

    admisiones.push(nuevaAdmision);

    localStorage.setItem(
        "aurora_admissions",
        JSON.stringify(admisiones)
    );

    auroraMostrarMensaje(
        "Solicitud de admisión registrada.",
        "success"
    );

    formulario.reset();
}

/* =========================================================
   23. DETECTAR FORMULARIOS
========================================================= */

function auroraDetectarFormularioRegistro() {
    const formularios = Array.from(document.querySelectorAll("form"));

    // Primero intenta encontrar los ID conocidos.
    const formularioPorId = document.querySelector(
        "#formRegistro, #formularioRegistro, #registroForm, #registro"
    );

    if (formularioPorId) return formularioPorId;

    // Si no existe un ID conocido, identifica el formulario
    // que contiene dos campos de contraseña.
    return formularios.find(formulario =>
        formulario.querySelectorAll('input[type="password"]').length >= 2
    ) || null;
}

function auroraDetectarFormularioLogin() {
    const formularioPorId = document.querySelector(
        "#formLogin, #formularioLogin, #loginForm"
    );

    if (formularioPorId) return formularioPorId;

    const formularios = Array.from(document.querySelectorAll("form"));

    return formularios.find(formulario =>
        formulario.querySelectorAll('input[type="password"]').length === 1
    ) || null;
}

/* =========================================================
   24. INICIALIZACIÓN DE LA APLICACIÓN
========================================================= */

document.addEventListener("DOMContentLoaded", async function () {
    try {
        await AuroraDB.inicializar();

        console.log(
            "Aurora University: base de datos lista."
        );

    } catch (error) {
        console.error(
            "Error al iniciar Aurora University:",
            error
        );

        auroraMostrarMensaje(
            "No se pudo iniciar la base de datos.",
            "error"
        );

        return;
    }

    // Menú adaptable.
    auroraMenuMovil();

    // Mostrar datos del usuario.
    auroraMostrarDatosUsuario();

    // Mostrar publicaciones.
    auroraMostrarPublicaciones();

    // Formulario de registro.
    const formularioRegistro = auroraDetectarFormularioRegistro();

    if (formularioRegistro) {
        formularioRegistro.addEventListener(
            "submit",
            auroraProcesarRegistro
        );

        console.log("Formulario de registro detectado.");
    }

    // Formulario de inicio de sesión.
    const formularioLogin = auroraDetectarFormularioLogin();

    if (formularioLogin && formularioLogin !== formularioRegistro) {
        formularioLogin.addEventListener(
            "submit",
            auroraProcesarLogin
        );

        console.log("Formulario de inicio de sesión detectado.");
    }

    // Formulario de contacto.
    const formularioContacto = document.querySelector("#formContacto");

    if (formularioContacto) {
        formularioContacto.addEventListener(
            "submit",
            auroraProcesarContacto
        );
    }

    // Formulario de admisión.
    const formularioAdmision = document.querySelector("#formAdmision");

    if (formularioAdmision) {
        formularioAdmision.addEventListener(
            "submit",
            auroraProcesarAdmision
        );
    }

    // Botones para cerrar sesión.
    document.querySelectorAll(
        "#cerrarSesion, .cerrar-sesion, [data-logout]"
    ).forEach(boton => {
        boton.addEventListener("click", auroraCerrarSesion);
    });

    // Búsqueda de usuarios.
    const buscar = document.querySelector("#buscarUsuario");
    const filtro = document.querySelector("#filtroFacultad");

    if (buscar) {
        buscar.addEventListener("input", auroraFiltrarUsuarios);
    }

    if (filtro) {
        filtro.addEventListener("change", auroraFiltrarUsuarios);
    }

    // Exportar usuarios.
    document.querySelectorAll(
        "#exportarUsuarios, [data-export-users]"
    ).forEach(boton => {
        boton.addEventListener(
            "click",
            auroraExportarUsuariosCSV
        );
    });

    // Panel de administración.
    if (
        window.location.pathname.toLowerCase()
            .includes("administracion")
    ) {
        if (auroraSoloAdministrador()) {
            await auroraCargarUsuariosAdmin();
        }
    }

    // Protección de páginas privadas.
    const paginasPrivadas = [
        "portal.html",
        "cursos.html",
        "tareas.html",
        "calificaciones.html",
        "chat.html",
        "comunidad.html",
        "pagos.html",
        "historial.html",
        "certificaciones.html",
        "administracion.html"
    ];

    const paginaActual = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    if (paginasPrivadas.includes(paginaActual)) {
        auroraProtegerPagina();
    }

    console.log("Aurora University: aplicación inicializada.");
});

/* =========================================================
   25. FUNCIONES GLOBALES
========================================================= */

window.auroraCerrarSesion = auroraCerrarSesion;
window.auroraProcesarRegistro = auroraProcesarRegistro;
window.auroraProcesarLogin = auroraProcesarLogin;
window.auroraCrearPublicacion = auroraCrearPublicacion;
window.auroraMostrarPublicaciones = auroraMostrarPublicaciones;
window.auroraDarLike = auroraDarLike;
window.auroraComentar = auroraComentar;
window.auroraRegistrarPago = auroraRegistrarPago;
window.auroraObtenerPagosUsuario = auroraObtenerPagosUsuario;
window.auroraEnviarMensajeChatbot = auroraEnviarMensajeChatbot;
window.auroraProcesarContacto = auroraProcesarContacto;
window.auroraProcesarAdmision = auroraProcesarAdmision;
window.auroraExportarUsuariosCSV = auroraExportarUsuariosCSV;
window.auroraFiltrarUsuarios = auroraFiltrarUsuarios;

console.log(
    "Aurora University: app.js cargado correctamente."
);
