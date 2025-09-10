// Global variables
let map = null;
let markers = [];
let polyline = null;
let locations = [];
let photos = [];

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');
    document.getElementById('photoInput').addEventListener('change', handlePhotoUpload);
});

// Navigation functions
function showSection(sectionName) {
    console.log('Showing section:', sectionName);
    
    // Hide home menu
    const homeMenu = document.getElementById('homeMenu');
    homeMenu.classList.remove('active');
    console.log('Home menu hidden');
    
    // Hide all sections
    document.querySelectorAll('.app-section').forEach(section => {
        section.classList.remove('active');
        console.log('Section hidden:', section.id);
    });
    
    // Show target section
    const section = document.getElementById(sectionName + 'Section');
    if (section) {
        section.classList.add('active');
        console.log('Section shown:', section.id);
        
        // Initialize map if needed
        if (sectionName === 'map' && !map) {
            setTimeout(initializeMap, 100);
        }
    } else {
        console.error('Section not found:', sectionName + 'Section');
    }
}

function showHome() {
    console.log('Showing home');
    
    // Hide all sections
    document.querySelectorAll('.app-section').forEach(section => {
        section.classList.remove('active');
        console.log('Section hidden:', section.id);
    });
    
    // Show home menu
    const homeMenu = document.getElementById('homeMenu');
    homeMenu.classList.add('active');
    console.log('Home menu shown');
}

// Map functions
function initializeMap() {
    if (map) return;
    
    try {
        map = L.map('map').setView([39.8283, -98.5795], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        console.log('Map initialized');
    } catch (error) {
        console.error('Map initialization failed:', error);
        showNotification('Failed to load map', 'error');
    }
}

function centerMap() {
    if (map && locations.length > 0) {
        const lastLocation = locations[locations.length - 1];
        map.setView([lastLocation.lat, lastLocation.lng], 10);
    }
}

function fitBounds() {
    if (map && markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Photo upload handler
async function handlePhotoUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    console.log(`Processing ${files.length} files`);
    showLoading();
    
    try {
        await processPhotos(files);
        
        if (locations.length > 0) {
            updateUI();
            plotPhotosOnMap();
            showNotification(`Found ${locations.length} photos with location data!`, 'success');
        } else {
            showNotification('No photos with location data found', 'error');
        }
    } catch (error) {
        console.error('Error processing photos:', error);
        showNotification('Error processing photos', 'error');
    } finally {
        hideLoading();
    }
}

// Process photos and extract location data
async function processPhotos(files) {
    locations = [];
    photos = [];
    let processed = 0;

    for (const file of files) {
        try {
            updateProgress((processed / files.length) * 100, `Processing ${processed + 1} of ${files.length}`);
            
            const exif = await exifr.parse(file);
            
            if (exif && exif.latitude && exif.longitude) {
                const date = getPhotoDate(exif, file);
                if (date && date.getFullYear() === 2024) {
                    const photoData = {
                        file: file,
                        lat: exif.latitude,
                        lng: exif.longitude,
                        date: date,
                        url: URL.createObjectURL(file)
                    };
                    
                    photos.push(photoData);
                    locations.push({ lat: photoData.lat, lng: photoData.lng, photo: photoData });
                }
            }
        } catch (error) {
            console.warn(`Could not process ${file.name}:`, error);
        }
        processed++;
    }
    
    // Sort by date
    photos.sort((a, b) => a.date - b.date);
    updateProgress(100, `Found ${photos.length} photos with location data`);
}

function getPhotoDate(exif, file) {
    const dateFields = ['DateTimeOriginal', 'DateTime', 'CreateDate'];
    
    for (const field of dateFields) {
        if (exif[field]) {
            const date = new Date(exif[field]);
            if (!isNaN(date.getTime())) return date;
        }
    }
    
    return new Date(file.lastModified);
}

// Plot photos on map
function plotPhotosOnMap() {
    if (!map || locations.length === 0) return;

    // Clear existing
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    if (polyline) {
        map.removeLayer(polyline);
        polyline = null;
    }

    // Add markers
    locations.forEach((location, index) => {
        const marker = L.marker([location.lat, location.lng]).addTo(map);
        const photo = location.photo;
        
        const popupContent = `
            <div style="text-align: center;">
                <img src="${photo.url}" style="width: 150px; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" />
                <div>${photo.date.toLocaleDateString()}</div>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        markers.push(marker);
    });

    // Add path
    if (locations.length > 1) {
        const latlngs = locations.map(loc => [loc.lat, loc.lng]);
        polyline = L.polyline(latlngs, { color: '#007AFF', weight: 3 }).addTo(map);
    }

    // Show map
    document.getElementById('map').style.display = 'block';
    document.getElementById('mapControls').style.display = 'flex';
    
    // Fit bounds
    setTimeout(() => fitBounds(), 500);
}

// Update UI elements
function updateUI() {
    updateStatsSummary();
    updateStatsSection();
    updateShareSection();
}

function updateStatsSummary() {
    const summary = document.getElementById('statsSummary');
    if (photos.length > 0) {
        document.getElementById('photoCount').textContent = photos.length;
        document.getElementById('locationCount').textContent = locations.length;
        
        const distance = calculateTotalDistance();
        document.getElementById('distanceCount').textContent = `${Math.round(distance)} km`;
        
        summary.style.display = 'flex';
    }
}

function updateStatsSection() {
    const container = document.getElementById('statsContainer');
    
    if (photos.length === 0) {
        container.innerHTML = '<div class="no-data"><p>Upload photos first to see your journey statistics</p></div>';
        return;
    }

    const stats = calculateDetailedStats();
    
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
    `;
}

function updateShareSection() {
    const preview = document.getElementById('sharePreview');
    const button = document.getElementById('shareButton');
    
    if (photos.length === 0) {
        preview.innerHTML = '<div class="no-data"><p>Upload photos to generate a shareable summary</p></div>';
        button.disabled = true;
        return;
    }

    const stats = calculateDetailedStats();
    
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

function calculateTotalDistance() {
    let total = 0;
    for (let i = 1; i < locations.length; i++) {
        const prev = locations[i - 1];
        const curr = locations[i];
        total += calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng) / 1000;
    }
    return total;
}

function calculateDetailedStats() {
    const stats = {
        totalPhotos: photos.length,
        totalLocations: locations.length,
        totalDistance: Math.round(calculateTotalDistance())
    };
    
    if (photos.length > 0) {
        const dates = photos.map(p => p.date);
        const startDate = new Date(Math.min(...dates));
        const endDate = new Date(Math.max(...dates));
        
        stats.startDate = startDate.toLocaleDateString();
        stats.endDate = endDate.toLocaleDateString();
        stats.duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    }
    
    return stats;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// Share functionality
function shareJourney() {
    if (photos.length === 0) {
        showNotification('Upload photos first!', 'error');
        return;
    }
    
    const stats = calculateDetailedStats();
    const shareText = `My 2024 Journey: ${stats.totalPhotos} photos from ${stats.totalLocations} locations, ${stats.totalDistance}km traveled!`;
    
    if (navigator.share) {
        navigator.share({ 
            title: '2024 Journey Mapped',
            text: shareText 
        }).then(() => {
            showNotification('Shared successfully!', 'success');
        }).catch(() => {
            copyToClipboard(shareText);
        });
    } else {
        copyToClipboard(shareText);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Copied to clipboard!', 'success');
        });
    }
}

// Utility functions
function showLoading() {
    document.getElementById('loadingScreen').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingScreen').classList.remove('active');
}

function updateProgress(percent, status) {
    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('loadingStatus').textContent = status;
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => notification.classList.remove('show'), 3000);
}