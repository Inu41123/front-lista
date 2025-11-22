    const API_URL = 'https://api-lista-pysh.onrender.com'; 
    let estadoActual = [];
    
    // Variables para saber qué estamos editando en el modal
    let editIndex = null;
    let editTipo = null; // 'tabla' o 'resumen'

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('fechaInput').valueAsDate = new Date();
        cargarDatos();
    });

    async function cargarDatos() {
        try {
            const res = await fetch(`${API_URL}/alumnos`);
            estadoActual = await res.json();
            if(estadoActual.length === 0) {
                await fetch(`${API_URL}/init`);
                cargarDatos(); // Reintentar
                return;
            }
            renderizarTabla();
        } catch (e) { console.error("Error API:", e); }
    }

    function renderizarTabla() {
        const tbody = document.getElementById('tablaCuerpo');
        tbody.innerHTML = '';

        estadoActual.forEach((alumno, index) => {
            const tr = document.createElement('tr');
            
            // Colores de fila
            if (!alumno.asistio) tr.classList.add('table-danger');
            // Si entregó AMBAS, se pone verde
            else if (alumno.checkTabla && alumno.checkResumen) tr.classList.add('table-success');
            // Si entregó solo una, un amarillo suave (opcional)
            else if (alumno.checkTabla || alumno.checkResumen) tr.classList.add('table-warning');

            // Verificamos si hay archivos
            const tieneFileTabla = alumno.archivoTablaBase64 ? true : false;
            const tieneFileResumen = alumno.archivoResumenBase64 ? true : false;

            tr.innerHTML = `
                <td>${alumno.no}</td>
                <td><code>${alumno.id}</code></td>
                <td class="text-start fw-bold small">${alumno.nombre}</td>
                
                <td>
                    <input type="checkbox" class="form-check-input status-check" 
                    ${alumno.asistio ? 'checked' : ''} 
                    onchange="updateDB('${alumno._id}', 'asistio', this.checked)">
                </td>

                <td class="col-fase file-indicator" data-status="${tieneFileTabla ? '(Arch)' : ''}">
                    <div class="d-flex justify-content-center gap-2 align-items-center">
                        <input type="checkbox" class="form-check-input status-check" 
                            ${alumno.checkTabla ? 'checked' : ''} 
                            onchange="updateDB('${alumno._id}', 'checkTabla', this.checked)">
                        
                        <button class="btn btn-file ${tieneFileTabla ? 'has-file' : ''}" 
                                onclick="abrirModal(${index}, 'tabla')" title="Subir Tabla">
                            <i class="bi bi-paperclip"></i>
                        </button>
                    </div>
                </td>

                <td class="col-fase file-indicator" data-status="${tieneFileResumen ? '(Arch)' : ''}">
                    <div class="d-flex justify-content-center gap-2 align-items-center">
                        <input type="checkbox" class="form-check-input status-check" 
                            ${alumno.checkResumen ? 'checked' : ''} 
                            onchange="updateDB('${alumno._id}', 'checkResumen', this.checked)">
                        
                        <button class="btn btn-file ${tieneFileResumen ? 'has-file' : ''}" 
                                onclick="abrirModal(${index}, 'resumen')" title="Subir Resumen">
                            <i class="bi bi-paperclip"></i>
                        </button>
                    </div>
                </td>

                <td>
                    <input type="text" class="form-control form-control-sm input-duda" 
                    value="${alumno.duda || ''}" 
                    onchange="updateDB('${alumno._id}', 'duda', this.value)">
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- COMUNICACIÓN CON SERVER ---
    async function updateDB(id, campo, valor) {
        // Optimistic update
        const al = estadoActual.find(a => a._id === id);
        if(al) al[campo] = valor;
        renderizarTabla();

        await fetch(`${API_URL}/alumnos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [campo]: valor })
        });
    }

    // --- MODAL LOGIC ---
    function abrirModal(index, tipo) {
        editIndex = index;
        editTipo = tipo; // 'tabla' or 'resumen'
        const al = estadoActual[index];

        // Configurar textos del modal
        document.getElementById('modalTitulo').innerText = 
            tipo === 'tabla' ? "Subir Evidencia: Fase 1 (Tabla)" : "Subir Evidencia: Fase 2 (Resumen)";
        document.getElementById('modalInfoAlumno').innerText = `Alumno: ${al.nombre}`;
        
        document.getElementById('inputFile').value = '';

        // Determinar qué archivo mostrar
        let base64 = tipo === 'tabla' ? al.archivoTablaBase64 : al.archivoResumenBase64;
        let nombre = tipo === 'tabla' ? al.archivoTablaNombre : al.archivoResumenNombre;

        mostrarPreview(base64, nombre);

        // Listener para subida
        document.getElementById('inputFile').onchange = (e) => manejarSubida(e, al._id);

        new bootstrap.Modal(document.getElementById('archivoModal')).show();
    }

    function manejarSubida(e, id) {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async function() {
            const base64 = reader.result;
            
            // Campos dinámicos según el tipo
            const campoBase64 = editTipo === 'tabla' ? 'archivoTablaBase64' : 'archivoResumenBase64';
            const campoNombre = editTipo === 'tabla' ? 'archivoTablaNombre' : 'archivoResumenNombre';
            const campoCheck = editTipo === 'tabla' ? 'checkTabla' : 'checkResumen';

            // Payload para Mongo
            const payload = {
                [campoBase64]: base64,
                [campoNombre]: file.name,
                [campoCheck]: true // Auto-check al subir
            };

            // Enviar
            await fetch(`${API_URL}/alumnos/${id}`, {
                method: 'PUT',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify(payload)
            });

            // Actualizar local
            const al = estadoActual[editIndex];
            al[campoBase64] = base64;
            al[campoNombre] = file.name;
            al[campoCheck] = true;
            
            mostrarPreview(base64, file.name);
            renderizarTabla();
        };
    }

    function eliminarArchivoActual() {
        const al = estadoActual[editIndex];
        if(!confirm("¿Borrar este archivo?")) return;

        const campoBase64 = editTipo === 'tabla' ? 'archivoTablaBase64' : 'archivoResumenBase64';
        const campoNombre = editTipo === 'tabla' ? 'archivoTablaNombre' : 'archivoResumenNombre';
        
        const payload = { [campoBase64]: null, [campoNombre]: null };
        
        fetch(`${API_URL}/alumnos/${al._id}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        }).then(() => {
            al[campoBase64] = null;
            al[campoNombre] = null;
            mostrarPreview(null);
            renderizarTabla();
        });
    }

    function mostrarPreview(base64, nombre) {
        const img = document.getElementById('previewImage');
        const pdf = document.getElementById('previewPDF');
        const ph = document.querySelector('.preview-placeholder');

        img.style.display = 'none';
        pdf.style.display = 'none';
        ph.style.display = 'none';

        if(!base64) {
            ph.style.display = 'block';
            ph.innerText = "No hay archivo subido";
            return;
        }

        if(base64.startsWith('data:image')) {
            img.src = base64;
            img.style.display = 'block';
        } else if(base64.includes('pdf')) {
            pdf.src = base64;
            pdf.style.display = 'block';
        } else {
            ph.style.display = 'block';
            ph.innerText = "Archivo: " + nombre;
        }
    }

    function imprimirPDF() { window.print(); }
    
    function generarJSON() {
        const reporte = {
            fecha: document.getElementById('fechaInput').value,
            alumnos: estadoActual.map(a => ({
                nombre: a.nombre,
                asistio: a.asistio,
                fase1_tabla: a.checkTabla ? "Entregado" : "Pendiente",
                fase2_resumen: a.checkResumen ? "Entregado" : "Pendiente"
            }))
        };
        document.getElementById('jsonOutputText').value = JSON.stringify(reporte, null, 2);
        document.getElementById('jsonContainer').style.display = 'block';
    }
    
    function borrarTodo() {
        // Opcional: lógica para borrar colección
        alert("Función deshabilitada por seguridad en este demo.");
    }
