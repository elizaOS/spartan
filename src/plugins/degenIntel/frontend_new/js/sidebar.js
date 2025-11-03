// Sidebar toggle functionality
document.addEventListener('DOMContentLoaded', function() {
  const sidebarToggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const mainContent = document.querySelector('main');
  
  if (!sidebarToggleBtn || !sidebar || !overlay) return;
  
  let isOpen = false;
  
  // Toggle sidebar when button is clicked
  sidebarToggleBtn.addEventListener('click', function() {
    isOpen = !isOpen;
    toggleSidebar();
  });
  
  // Close sidebar when clicking outside of it (on the overlay)
  overlay.addEventListener('click', function() {
    isOpen = false;
    closeSidebar();
  });
  
  // Close sidebar on ESC key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      closeSidebar();
    }
  });
  
  function toggleSidebar() {
    if (isOpen) {
      sidebar.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
      mainContent.classList.add('overflow-hidden');
    } else {
      closeSidebar();
    }
  }
  
  function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
    mainContent.classList.remove('overflow-hidden');
  }
});