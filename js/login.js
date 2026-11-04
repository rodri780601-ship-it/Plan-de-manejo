/* ==========================================================================
   Portada de acceso (login). Usuario ficticio de demostración.
   OJO: es una barrera del lado del cliente; no reemplaza una autenticación
   real con servidor (cualquiera con acceso al código puede saltársela).
   ========================================================================== */
'use strict';
(function () {
  const SESSION_KEY = 'pmfbn_sesion';
  const SALT = 'pmfbn:';
  const USUARIOS = {
    // usuario: { hash: sha256(SALT + usuario + ':' + clave), nombre }
    mrojas: { hash: 'fb73905ce24d3039403ec961168d8230ff36c2f5a1e1fbea525603a67b06e8e4', nombre: 'María Rojas (demo)' }
  };

  const $ = id => document.getElementById(id);

  async function sha256(txt) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return null;
  }

  function getSesion() { try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; } }
  function setSesion(v) { try { v ? sessionStorage.setItem(SESSION_KEY, v) : sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* sin almacenamiento */ } }

  function mostrar(nombre) {
    document.body.classList.remove('locked');
    const u = $('user-name');
    if (u) u.textContent = nombre;
  }

  function bloquear() {
    document.body.classList.add('locked');
    $('login-pass').value = '';
    $('login-err').hidden = true;
    $('login-user').focus();
  }

  async function ingresar(ev) {
    ev.preventDefault();
    const user = $('login-user').value.trim().toLowerCase();
    const pass = $('login-pass').value;
    const err = $('login-err');
    const u = Object.prototype.hasOwnProperty.call(USUARIOS, user) ? USUARIOS[user] : null;
    const h = await sha256(SALT + user + ':' + pass);
    if (h === null) { err.textContent = 'Este navegador no permite validar la clave (se requiere HTTPS o localhost).'; err.hidden = false; return; }
    if (u && h === u.hash) {
      setSesion(user);
      mostrar(u.nombre);
    } else {
      err.textContent = 'Usuario o clave incorrectos.';
      err.hidden = false;
      $('login-pass').select();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('login-form').addEventListener('submit', ingresar);
    $('login-demo').addEventListener('click', () => {
      $('login-user').value = 'mrojas';
      $('login-pass').value = 'Bosque2025!';
      $('login-form').requestSubmit();
    });
    $('btn-logout').addEventListener('click', () => { setSesion(null); bloquear(); });
    $('login-toggle').addEventListener('click', () => {
      const p = $('login-pass'), show = p.type === 'password';
      p.type = show ? 'text' : 'password';
      $('login-toggle').textContent = show ? 'Ocultar' : 'Mostrar';
    });
    const s = getSesion();
    if (s && USUARIOS[s]) mostrar(USUARIOS[s].nombre); else bloquear();
  });
})();
