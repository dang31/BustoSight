// global.js
document.addEventListener("DOMContentLoaded", function() {
    // Hanapin ang logout button sa kahit anong page
    const logoutBtn = document.querySelector('.logout-btn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            const confirmLogout = confirm("Are you sure you want to logout?");
            if (confirmLogout) {
                sessionStorage.clear();
                // Siguraduhing tama ang path papuntang login.html
                window.location.href = 'loginpage.html'; 
            }
        });
    }
});