document.getElementById('password').addEventListener('input', function () {
    const password = this.value;
    const strengthValue = document.getElementById('passwordStrengthValue');
    const strengthProgress = document.getElementById('passwordStrengthProgress');

    let strength = 0;

    if (password.length > 0) strength += 20;
    if (password.length >= 6) strength += 30;
    if (password.length >= 10) strength += 30;
    if (/[A-Z]/.test(password)) strength += 10;
    if (/[0-9]/.test(password)) strength += 10;

    strength = Math.min(strength, 100);
    strengthProgress.style.width = strength + '%';

    if (password.length === 0) {
        strengthValue.textContent = '-';
        strengthProgress.style.width = '0%';
        strengthProgress.style.backgroundColor = '';
    } else if (strength < 30) {
        strengthValue.textContent = 'Très faible';
        strengthValue.style.color = 'var(--danger)';
        strengthProgress.style.backgroundColor = 'var(--danger)';
    } else if (strength < 70) {
        strengthValue.textContent = 'Moyenne';
        strengthValue.style.color = 'var(--warning)';
        strengthProgress.style.backgroundColor = 'var(--warning)';
    } else {
        strengthValue.textContent = 'Forte';
        strengthValue.style.color = 'var(--success)';
        strengthProgress.style.backgroundColor = 'var(--success)';
    }
});

document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const loginBtn = document.querySelector('.login-btn');
    loginBtn.innerHTML = '<span class="animate__animated animate__fadeIn">Connexion en cours...</span>';
    loginBtn.disabled = true;

    setTimeout(() => {
        loginBtn.classList.add('animate__animated', 'animate__pulse');
        loginBtn.innerHTML = '<span class="animate__animated animate__fadeIn">Connexion réussie !</span>';

        setTimeout(() => {
            loginBtn.classList.remove('animate__animated', 'animate__pulse');
            loginBtn.innerHTML = 'Se connecter';
            loginBtn.disabled = false;
        }, 1500);
    }, 1500);
});
