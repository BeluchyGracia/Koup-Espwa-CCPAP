
        document.getElementById('password').addEventListener('input', function() {
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

        document.getElementById('registrationForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const btn = this.querySelector('button');
            btn.innerHTML = 'Traitement en cours...';
            btn.disabled = true;
            
            setTimeout(() => {
                btn.classList.add('animate__animated', 'animate__pulse');
                btn.innerHTML = 'Inscription réussie !'; 
                
                setTimeout(() => {
                    btn.classList.remove('animate__animated', 'animate__pulse');
                    btn.innerHTML = 'S\'inscrire maintenant <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
                    btn.disabled = false;
                    this.reset();
                    document.getElementById('passwordStrengthValue').textContent = '-';
                    document.getElementById('passwordStrengthProgress').style.width = '0%';
                }, 1500);
            }, 1500);
        });
