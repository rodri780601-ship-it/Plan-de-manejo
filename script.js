// Javascript dinámico para Formulario PMFBN 2020

document.addEventListener('DOMContentLoaded', () => {
    const rutInput = document.getElementById('rut_postulante');
    const sigRutDisplay = document.getElementById('sig_rut_display');

    rutInput.addEventListener('input', (e) => {
        sigRutDisplay.textContent = e.target.value.trim() || '____________________';
    });

    const budgetTable = document.getElementById('budgetTable');
    budgetTable.addEventListener('input', (e) => {
        if (e.target.classList.contains('calc-qty') || e.target.classList.contains('calc-price')) {
            calculateRowTotal(e.target.closest('tr'));
            calculateGrandTotal();
        }
    });

    const today = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('fecha_solicitud');
    if (fechaInput && !fechaInput.value) {
        fechaInput.value = today;
    }
});

function calculateRowTotal(row) {
    const qty = parseFloat(row.querySelector('.calc-qty').value) || 0;
    const price = parseFloat(row.querySelector('.calc-price').value) || 0;
    const totalInput = row.querySelector('.calc-total');
    
    const total = qty * price;
    totalInput.value = Math.round(total);
}

function calculateGrandTotal() {
    const totalInputs = document.querySelectorAll('.calc-total');
    let grandTotal = 0;
    
    totalInputs.forEach(input => {
        grandTotal += parseFloat(input.value) || 0;
    });

    document.getElementById('monto_total_general').value = Math.round(grandTotal);
}

function addRow() {
    const tbody = document.querySelector('#budgetTable tbody');
    const newRow = document.createElement('tr');
    
    newRow.innerHTML = `
        <td><input type="text" name="item_nombre[]" placeholder="Ej: Adquisición de plantas / Insumos" required></td>
        <td><input type="number" name="item_cantidad[]" class="calc-qty" value="1" min="1" required></td>
        <td><input type="number" name="item_costo[]" class="calc-price" value="0" min="0" required></td>
        <td><input type="number" name="item_total[]" class="calc-total" value="0" readonly></td>
        <td class="no-print"><button type="button" class="btn-remove" onclick="removeRow(this)">✕</button></td>
    `;
    
    tbody.appendChild(newRow);
}

function removeRow(button) {
    const tbody = document.querySelector('#budgetTable tbody');
    if (tbody.querySelectorAll('tr').length > 1) {
        button.closest('tr').remove();
        calculateGrandTotal();
    } else {
        alert("El presupuesto debe contener al menos un ítem.");
    }
}

function guardarEImprimir() {
    const form = document.getElementById('pmfbnForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    window.print();
}

function limpiarFormulario() {
    if (confirm("¿Está seguro de que desea reiniciar y borrar todos los campos introducidos?")) {
        document.getElementById('pmfbnForm').reset();
        document.getElementById('sig_rut_display').textContent = '____________________';
        calculateGrandTotal();
    }
}
