class PhotoJourneyApp {
    constructor() {
        this.map = null;
        this.markers = [];
        this.polyline = null;
        this.locations = [];
        this.photos = [];
        this.currentSection = 'home';
        
        this.initializeApp();
    }

    initializeApp() {
        // Add event listener for photo input
        document.getElementById('photoInput').addEventListener('change', (e) => this.handlePhotoUpload(e));
        
        console.log('2025 Mapped App initialized');
    }

    // Navigation
    showSection(sectionName) {
        this.hideAllSections();
        
        const section = document.getElementById(sectionName + 'Section');
        if (section) {
            section.classList.add('active');
            this.currentSection = sectionName;
            
            // Initialize map if showing map section
            if (sectionName === 'map' && !this.map) {
                setTimeout(() => this.initializeMap(), 100);
            }
        }
    }

    showHome() {
        this.hideAllSections();
        document.getElementById('homeMenu').classList.add('active');
        this.currentSection = 'home';
    }

    hideAllSections() {
        document.getElementById('homeMenu').classList.remove('active');
        document.querySelectorAll('.app-section').forEach(section => {
            section.classList.remove('active');
        });
    }

    // Map functionality
    initializeMap() {
        if (this.map) return;

        try {
            const mapElement = document.getElementById('map');
            if (!mapElement) return;

            this.map = L.map('map').setView([39.8283, -98.5795], 4); // Center of USA
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);

            console.log('Map initialized successfully');
        } catch (error) {
            console.error('Failed to initialize map:', error);
            this.showNotification('Failed to load map', 'error');
        }
    }

    // Photo processing
    async handlePhotoUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        console.log(`Processing ${files.length} files...`);
        
        this.showLoading();
        this.updateProgress(0, 'Starting photo analysis...');

        try {
            const photoData = await this.processPhotos(files);
            
            if (photoData.length > 0) {
                this.photos = photoData;
                this.locations = photoData.map(p => ({ lat: p.lat, lng: p.lng, photo: p }));
                
                this.updateUI();
                this.plotPhotosOnMap();
                this.showNotification(`Found ${photoData.length} photos with location data!`, 'success');
            } else {
                this.showNotification('No photos with location data found. Make sure location services were enabled.', 'error');
            }
        } catch (error) {
            console.error('Error processing photos:', error);
            this.showNotification('Error processing photos. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async processPhotos(files) {
        const photoData = [];
        let processed = 0;

        for (const file of files) {
            try {
                // Check if exifr is available
                if (typeof exifr === 'undefined') {
                    console.error('exifr library not loaded');
                    break;
                }

                const exif = await exifr.parse(file);
                
                if (exif && exif.latitude && exif.longitude) {
                    // Check if photo is from 2024
                    const date = this.getPhotoDate(exif, file);
                    if (date && date.getFullYear() === 2024) {
                        photoData.push({
                            file: file,
                            lat: exif.latitude,
                            lng: exif.longitude,
                            date: date,
                            url: URL.createObjectURL(file)
                        });
                    }
                }
            } catch (error) {
                console.warn(`Could not process ${file.name}:`, error);
            }

            processed++;
            const progress = (processed / files.length) * 100;
            this.updateProgress(progress, `Processed ${processed} of ${files.length} photos...`);
        }

        // Sort by date
        photoData.sort((a, b) => a.date - b.date);
        
        return photoData;
    }

    getPhotoDate(exif, file) {
        // Try various EXIF date fields
        const dateFields = ['DateTimeOriginal', 'DateTime', 'CreateDate', 'DateTimeDigitized'];
        
        for (const field of dateFields) {
            if (exif[field]) {
                const date = new Date(exif[field]);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }
        
        // Fallback to file modification date
        return new Date(file.lastModified);
    }

    // Map plotting
    plotPhotosOnMap() {
        if (!this.map || this.locations.length === 0) return;

        // Clear existing markers and polyline
        this.clearMap();

        // Add markers for each photo
        this.locations.forEach((location, index) => {
            const marker = L.marker([location.lat, location.lng]).addTo(this.map);
            
            // Create popup content
            const photo = location.photo;
            const popupContent = `
                <div style="text-align: center; min-width: 200px;">
                    <img src="${photo.url}" style="width: 150px; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" />
                    <div style="font-weight: 500;">${photo.date.toLocaleDateString()}</div>
                    <div style="font-size: 12px; color: #666;">Photo ${index + 1} of ${this.locations.length}</div>
                </div>
            `;
            marker.bindPopup(popupContent);
            this.markers.push(marker);
        });

        // Add path connecting all locations
        if (this.locations.length > 1) {
            const latlngs = this.locations.map(loc => [loc.lat, loc.lng]);
            this.polyline = L.polyline(latlngs, {
                color: '#007AFF',
                weight: 3,
                opacity: 0.7
            }).addTo(this.map);
        }

        // Show map and controls
        document.getElementById('map').style.display = 'block';
        document.getElementById('mapControls').style.display = 'flex';

        // Fit map to show all locations
        this.fitBounds();
    }

    clearMap() {
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        
        if (this.polyline) {
            this.map.removeLayer(this.polyline);
            this.polyline = null;
        }
    }

    centerMap() {
        if (this.locations.length > 0) {
            const lastLocation = this.locations[this.locations.length - 1];
            this.map.setView([lastLocation.lat, lastLocation.lng], 10);
        }
    }

    fitBounds() {
        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    // Statistics calculation
    calculateStats() {
        if (this.locations.length === 0) return {};

        const stats = {};
        
        // Basic counts
        stats.totalPhotos = this.photos.length;
        stats.totalLocations = this.locations.length;
        
        // Calculate total distance
        let totalDistance = 0;
        for (let i = 1; i < this.locations.length; i++) {
            const prev = this.locations[i - 1];
            const curr = this.locations[i];
            totalDistance += this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        }
        stats.totalDistance = Math.round(totalDistance / 1000); // Convert to km
        
        // Date range
        if (this.photos.length > 0) {
            const dates = this.photos.map(p => p.date);
            const startDate = new Date(Math.min(...dates));
            const endDate = new Date(Math.max(...dates));
            
            stats.startDate = startDate.toLocaleDateString();
            stats.endDate = endDate.toLocaleDateString();
            
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            stats.duration = daysDiff;
        }
        
        // Most active month
        const monthCounts = {};
        this.photos.forEach(photo => {
            const month = photo.date.toLocaleDateString('en-US', { month: 'long' });
            monthCounts[month] = (monthCounts[month] || 0) + 1;
        });
        
        if (Object.keys(monthCounts).length > 0) {
            const mostActive = Object.entries(monthCounts).reduce((a, b) => a[1] > b[1] ? a : b);
            stats.mostActiveMonth = `${mostActive[0]} (${mostActive[1]} photos)`;
        }

        return stats;
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }

    // UI Updates
    updateUI() {
        this.updateStatsSummary();
        this.updateStatsSection();
        this.updateShareSection();
    }

    updateStatsSummary() {
        const summary = document.getElementById('statsSummary');
        if (this.photos.length > 0) {
            const stats = this.calculateStats();
            
            document.getElementById('photoCount').textContent = stats.totalPhotos;
            document.getElementById('locationCount').textContent = stats.totalLocations;
            document.getElementById('distanceCount').textContent = `${stats.totalDistance} km`;
            
            summary.style.display = 'flex';
        }
    }

    updateStatsSection() {
        const container = document.getElementById('statsContainer');
        
        if (this.photos.length === 0) {
            container.innerHTML = '<div class="no-data"><p>Upload photos first to see your journey statistics</p></div>';
            return;
        }

        const stats = this.calculateStats();
        
        container.innerHTML = `
            <div class="stat-card">
                <h3>Total Photos</h3>
                <div class="value">${stats.totalPhotos}</div>
                <div class="description">Photos with location data from 2024</div>
            </div>
            <div class="stat-card">
                <h3>Locations Visited</h3>
                <div class="value">${stats.totalLocations}</div>
                <div class="description">Unique places you've been</div>
            </div>
            <div class="stat-card">
                <h3>Distance Traveled</h3>
                <div class="value">${stats.totalDistance} km</div>
                <div class="description">Total distance between photo locations</div>
            </div>
            <div class="stat-card">
                <h3>Journey Duration</h3>
                <div class="value">${stats.duration || 0} days</div>
                <div class="description">From ${stats.startDate || 'N/A'} to ${stats.endDate || 'N/A'}</div>
            </div>
            ${stats.mostActiveMonth ? `
                <div class="stat-card">
                    <h3>Most Active Month</h3>
                    <div class="value">${stats.mostActiveMonth}</div>
                    <div class="description">Month with the most photos</div>
                </div>
            ` : ''}
        `;
    }

    updateShareSection() {
        const preview = document.getElementById('sharePreview');
        const button = document.getElementById('shareButton');
        
        if (this.photos.length === 0) {
            preview.innerHTML = '<div class="no-data"><p>Upload photos to generate a shareable summary</p></div>';
            button.disabled = true;
            return;
        }

        const stats = this.calculateStats();
        
        preview.innerHTML = `
            <div style="text-align: center;">
                <h3 style="margin-bottom: 15px;">My 2024 Journey</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #007AFF;">${stats.totalPhotos}</div>
                        <div style="font-size: 12px; color: #666;">Photos</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #34C759;">${stats.totalLocations}</div>
                        <div style="font-size: 12px; color: #666;">Places</div>
                    </div>
                </div>
                <div style="font-size: 18px; font-weight: bold; color: #FF9500; margin-bottom: 10px;">${stats.totalDistance} km traveled</div>
                <div style="font-size: 14px; color: #666;">
                    ${stats.startDate} - ${stats.endDate}
                </div>
            </div>
        `;
        
        button.disabled = false;
    }

    // Share functionality
    shareJourney() {
        if (this.photos.length === 0) {
            this.showNotification('Upload photos first to share your journey!', 'error');
            return;
        }

        const stats = this.calculateStats();
        const shareText = `My 2024 Journey Mapped!

📍 ${stats.totalPhotos} photos from ${stats.totalLocations} locations
🛣️ ${stats.totalDistance} kilometers traveled
📅 ${stats.startDate} to ${stats.endDate}
${stats.mostActiveMonth ? `🔥 Most active: ${stats.mostActiveMonth}` : ''}

#2025Mapped #PhotoJourney`;

        if (navigator.share) {
            navigator.share({
                title: '2025 Mapped - My Photo Journey',
                text: shareText,
            }).then(() => {
                this.showNotification('Shared successfully!', 'success');
            }).catch((error) => {
                if (error.name !== 'AbortError') {
                    this.copyToClipboard(shareText);
                }
            });
        } else {
            this.copyToClipboard(shareText);
        }
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('Journey summary copied to clipboard!', 'success');
            }).catch(() => {
                this.showNotification('Could not copy to clipboard', 'error');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                this.showNotification('Journey summary copied to clipboard!', 'success');
            } catch (err) {
                this.showNotification('Could not copy to clipboard', 'error');
            }
            
            document.body.removeChild(textArea);
        }
    }

    // Loading and progress
    showLoading() {
        document.getElementById('loadingScreen').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loadingScreen').classList.remove('active');
    }

    updateProgress(percent, status) {
        const fill = document.getElementById('progressFill');
        const statusElement = document.getElementById('loadingStatus');
        
        fill.style.width = `${percent}%`;
        statusElement.textContent = status;
    }

    // Notifications
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PhotoJourneyApp();
});