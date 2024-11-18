// Sidebar Menu
const allSideMenu = document.querySelectorAll('#sidebar .side-menu.top li a');

allSideMenu.forEach(item => {
    const li = item.parentElement;

    item.addEventListener('click', function () {
        allSideMenu.forEach(i => {
            i.parentElement.classList.remove('active');
        });
        li.classList.add('active');
    });
});

// Toggle Sidebar
const menuBar = document.querySelector('#content nav .bx.bx-menu');
const sidebar = document.getElementById('sidebar');

menuBar.addEventListener('click', function () {
    sidebar.classList.toggle('hide');
    adjustContentWidth();
});

// Adjust content width based on sidebar state
function adjustContentWidth() {
    const isSidebarHidden = sidebar.classList.contains('hide');
    const content = document.querySelector('#content');
    content.style.width = isSidebarHidden ? 'calc(100% - 60px)' : 'calc(100% - 280px)';
    content.style.left = isSidebarHidden ? '60px' : '280px';
}

// Search Button
const searchButton = document.querySelector('#content nav form .form-input button');
const searchButtonIcon = document.querySelector('#content nav form .form-input button .bx');
const searchForm = document.querySelector('#content nav form');

searchButton.addEventListener('click', function (e) {
    if (window.innerWidth < 576) {
        e.preventDefault();
        searchForm.classList.toggle('show');
        if (searchForm.classList.contains('show')) {
            searchButtonIcon.classList.replace('bx-search', 'bx-x');
        } else {
            searchButtonIcon.classList.replace('bx-x', 'bx-search');
        }
    }
});

// Update content width and search form state on load and resize
function updateLayout() {
    if (window.innerWidth < 768) {
        sidebar.classList.add('hide');
    } else {
        sidebar.classList.remove('hide');
    }
    adjustContentWidth();

    if (window.innerWidth > 576) {
        searchButtonIcon.classList.replace('bx-x', 'bx-search');
        searchForm.classList.remove('show');
    }
}

window.addEventListener('resize', updateLayout);
window.addEventListener('load', updateLayout);

// Switch Mode
const switchMode = document.getElementById('switch-mode');

switchMode.addEventListener('change', function () {
    document.body.classList.toggle('dark', this.checked);
});

// Initialize Maps
const liveMap = L.map('live-map').setView([0, 0], 13);
const historyMap = L.map('history-map').setView([0, 0], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(liveMap);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(historyMap);

let liveMarker = L.marker([0, 0]).addTo(liveMap); // Only one live marker
let routeLayer = L.layerGroup().addTo(liveMap); // Layer for the route
let geofenceCircle = L.circle([0, 0], { radius: 0 }).addTo(liveMap); // Initially set radius to 0
let historyRouteLayer = L.layerGroup().addTo(historyMap); // Layer for history routes
let historyGeofenceCircle = L.circle([0, 0], { radius: 0 }).addTo(historyMap); // Initially set radius to 0

let routeCoordinates = []; // Store coordinates for the route

// Update Location
function updateLocation(position) {
    const { latitude, longitude, speed } = position.coords;

    // Update live marker with live location
    liveMarker.setLatLng([latitude, longitude]);
    liveMap.setView([latitude, longitude], 13);

    // Update history map with the live location
    historyMap.setView([latitude, longitude], 13);

    // Only display route and circle if they are set
    if (geofenceCircle.getRadius() > 0) {
        // Clear previous route on live map
        routeLayer.clearLayers();

        // Show route to geofence
        const route = L.polyline([
            [latitude, longitude],
            geofenceCircle.getLatLng()
        ], { color: 'blue' }).addTo(routeLayer);

        // Update history map
        historyRouteLayer.clearLayers();
        L.polyline([
            [latitude, longitude],
            geofenceCircle.getLatLng()
        ], { color: 'blue' }).addTo(historyRouteLayer);

        // Update geofence circle on history map
        historyGeofenceCircle.setLatLng(geofenceCircle.getLatLng());
        historyGeofenceCircle.setRadius(geofenceCircle.getRadius());
    }

    // Update information panel
    document.getElementById('latitude').textContent = latitude;
    document.getElementById('longitude').textContent = longitude;
    document.getElementById('speed').textContent = speed ? `${speed} m/s` : 'N/A';

    // Send location to ESP32
    fetch(`http://ESP32_IP_ADDRESS/update_location?lat=${latitude}&lng=${longitude}`)
        .then(response => response.text())
        .then(data => console.log(data))
        .catch(error => console.error('Error:', error));
}

// Handle Location Error
function handleLocationError() {
    document.getElementById('status').textContent = 'Unable to retrieve your location';
}

// Get Live Location
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(updateLocation, handleLocationError, {
        enableHighAccuracy: true
    });
}

// Fetch and update Arduino location every 5 seconds
function fetchArduinoLocation() {
    fetch('http://ESP32_IP_ADDRESS/get_location')
        .then(response => response.json())
        .then(data => {
            const { lat, lng } = data;

            // Update Arduino marker
            liveMarker.setLatLng([lat, lng]);

            console.log('Arduino Location:', lat, lng);
        })
        .catch(error => console.error('Error:', error));
}

// Set an interval to fetch Arduino location every 5 seconds
setInterval(fetchArduinoLocation, 5000);

// Set Geofence
document.getElementById('set-geofence').addEventListener('click', function () {
    const lat = parseFloat(document.getElementById('geo-lat').value);
    const lng = parseFloat(document.getElementById('geo-lng').value);
    const radius = parseFloat(document.getElementById('geo-radius').value);

    if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius) && radius > 0) {
        // Update geofence circle with new location and radius
        geofenceCircle.setLatLng([lat, lng]);
        geofenceCircle.setRadius(radius * 1000); // Convert to meters
        liveMap.setView([lat, lng], 13);

        // Clear previous route and update route to the new geofence location
        routeLayer.clearLayers();
        routeCoordinates = [[liveMarker.getLatLng().lat, liveMarker.getLatLng().lng], [lat, lng]];

        if (routeCoordinates.length > 1) {
            const route = L.polyline(routeCoordinates, { color: 'blue' }).addTo(routeLayer);
        }

        // Update history map with geofence data
        historyMap.setView([lat, lng], 13);
        historyGeofenceCircle.setLatLng([lat, lng]);
        historyGeofenceCircle.setRadius(radius * 1000); // Convert to meters
        historyRouteLayer.clearLayers();
        if (routeCoordinates.length > 1) {
            L.polyline(routeCoordinates, { color: 'blue' }).addTo(historyRouteLayer);
        }

        // Send geofence data to ESP32
        fetch(`http://ESP32_IP_ADDRESS/set_geofence?lat=${lat}&lng=${lng}&radius=${radius}`)
            .then(response => response.text())
            .then(data => console.log(data))
            .catch(error => console.error('Error:', error));
    } else {
        alert('Please enter valid latitude, longitude, and radius');
    }
});

// Geofencing Check
function checkGeofence(latitude, longitude) {
    const distance = liveMap.distance([latitude, longitude], geofenceCircle.getLatLng());
    return distance > geofenceCircle.getRadius();
}

// Alert Button
document.getElementById('alertBtn').addEventListener('click', function () {
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        if (checkGeofence(latitude, longitude)) {
            alert('You are out of bounds!');
            // Send alert to ESP32
            fetch(`http://ESP32_IP_ADDRESS/send_alert`)
                .then(response => response.text())
                .then(data => console.log(data))
                .catch(error => console.error('Error:', error));
        }
    });
});

// Emergency Call Button
document.getElementById('callBtn').addEventListener('click', function () {
    fetch('http://ESP32_IP_ADDRESS/send_call')
        .then(response => response.text())
        .then(data => console.log(data))
        .catch(error => console.error('Error:', error));
});

// SMS Button
document.getElementById('smsBtn').addEventListener('click', function () {
    fetch('http://ESP32_IP_ADDRESS/send_sms?message=Emergency!')
        .then(response => response.text())
        .then(data => console.log(data))
        .catch(error => console.error('Error:', error));
});
