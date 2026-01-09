// Router utility for clean URL handling
// Supports formats: #2026/01, #2026, #2026-01, #2026/01/15, #2026/01/15/overview, etc.

const Router = {
    // Parse hash into route object
    parseHash(hash) {
        // Remove leading #
        const path = hash.replace(/^#/, '').trim();
        
        if (!path) {
            return { year: 'all', month: 'all', day: 'all', tab: 'overview' };
        }

        // Split by / or - to handle different formats
        const parts = path.split(/[/-]/);
        
        let year = 'all';
        let month = 'all';
        let day = 'all';
        let tab = 'overview';

        // Check if first part is a valid year (4 digits)
        if (parts[0] && /^\d{4}$/.test(parts[0])) {
            year = parts[0];
            
            // Check if second part is a valid month (01-12) or a tab name
            if (parts[1]) {
                if (/^(0[1-9]|1[0-2])$/.test(parts[1])) {
                    month = parts[1];
                    // Third part could be a day (01-31) or a tab
                    if (parts[2]) {
                        if (/^(0[1-9]|[12][0-9]|3[01])$/.test(parts[2])) {
                            day = parts[2];
                            // Fourth part could be a tab
                            if (parts[3] && this.isValidTab(parts[3])) {
                                tab = parts[3];
                            }
                        } else if (this.isValidTab(parts[2])) {
                            // Third part is a tab, no day specified
                            tab = parts[2];
                        }
                    }
                } else if (this.isValidTab(parts[1])) {
                    // Second part is a tab, no month specified
                    tab = parts[1];
                }
            }
        } else if (parts[0] && this.isValidTab(parts[0])) {
            // First part is a tab, no year/month
            tab = parts[0];
        }

        return { year, month, day, tab };
    },

    // Build hash from route object
    buildHash(route) {
        const { year, month, day, tab } = route;
        
        // Default to overview if not specified
        const activeTab = tab || 'overview';
        
        if (year === 'all') {
            // If no year, just show tab if it's not overview
            return activeTab !== 'overview' ? `#${activeTab}` : '';
        }

        const parts = [year];
        
        if (month !== 'all') {
            parts.push(month);
            
            if (day !== 'all') {
                parts.push(day);
            }
        }
        
        // Only add tab if it's not overview
        if (activeTab !== 'overview') {
            parts.push(activeTab);
        }

        return `#${parts.join('/')}`;
    },

    // Check if a string is a valid tab name
    isValidTab(tab) {
        const validTabs = ['overview', 'openings', 'sessions', 'monthly', 'stats', 'games', 'fun'];
        return validTabs.includes(tab);
    },

    // Get current route from hash
    getCurrentRoute() {
        return this.parseHash(window.location.hash);
    },

    // Navigate to a new route
    navigate(route) {
        const hash = this.buildHash(route);
        window.location.hash = hash;
    },

    // Update route with partial updates
    updateRoute(updates) {
        const current = this.getCurrentRoute();
        const newRoute = { ...current, ...updates };
        this.navigate(newRoute);
    }
};
