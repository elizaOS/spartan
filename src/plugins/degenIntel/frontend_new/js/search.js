// Search functionality
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search');
  const quickSearchInput = document.getElementById('quick-search');
  
  if (searchInput) {
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        handleSearch(searchInput.value);
      }
    });
  }
  
  if (quickSearchInput) {
    const searchButton = quickSearchInput.parentElement.nextElementSibling;
    
    quickSearchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        handleSearch(quickSearchInput.value);
      }
    });
    
    searchButton.addEventListener('click', function() {
      handleSearch(quickSearchInput.value);
    });
  }
  
  function handleSearch(query) {
    if (!query.trim()) return;
    
    console.log('Searching for:', query);
    
    // Validate if it's a potential wallet or token address
    if (isValidAddress(query)) {
      // Here you would redirect to an address page or show results
      alert(`Searching for address: ${query}`);
    } else {
      // Search for token name or other queries
      alert(`Searching for: ${query}`);
    }
  }
  
  function isValidAddress(address) {
    // Basic validation for Ethereum-like addresses
    // This is a simple check, in a real app you'd want more robust validation
    return /^(0x)?[0-9a-fA-F]{40}$/.test(address);
  }
});