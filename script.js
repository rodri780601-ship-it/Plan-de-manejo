// Lógica Javascript para el Formulario PMFBN

function imprimirFormulario() {
    const form = document.getElementById('formularioPMFBN');
    
    // Validar si los campos obligatorios están completos
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Disparar diálogo del sistema para Imprimir o Guardar como PDF
    window.print();
}

function resetFormulario() {
    if (confirm("¿Está seguro de que desea borrar todos los campos introducidos?")) {
        document.getElementById('formularioPMFBN').reset();
    }
}
