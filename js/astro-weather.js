jQuery(document).ready(function($) {
    const dashboard = $('.astro-weather-dashboard');
    let weatherData = null;
    let currentUnits = 'metric';

    // Initialize timeline with empty data immediately
    const timelineContainer = document.querySelector('.astro-weather-timeline');
    if (timelineContainer) {
        const emptyData = {
            time: Array(168).fill(undefined),
            clouds: Array(168).fill(undefined),
            seeing: Array(168).fill(undefined),
            wind: Array(168).fill(undefined),
            humidity: Array(168).fill(undefined)
        };
        window.TimelineView.initializeTimeline(
            timelineContainer,
            emptyData,
            currentUnits
        );
    }
    
    // Initialize time slider with current hour
    const timeSlider = $('.time-slider')[0];
    if (timeSlider) {
        timeSlider.value = new Date().getHours();
        updateSliderBackground(timeSlider); // Initial background update
    }

    // Function to update slider background fill
    function updateSliderBackground(slider) {
        if (!slider) return;
        const value = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
        slider.style.backgroundImage = `linear-gradient(to right, #2563eb 0%, #2563eb ${value}%, #333 ${value}%, #333 100%)`;
    }

    // Update display and slider background on slider change
    $('.time-slider').on('input', function() {
        updateSliderBackground(this);
        updateDisplayForHour(parseInt(this.value));
    });

    function convertTemp(temp, toImperial) {
        return toImperial ? (temp * 9/5) + 32 : temp;
    }

    function calculateRating(value, type) {
        const inverted = ['clouds', 'wind', 'humidity'].includes(type);
        let rating;
        
        if (type === 'clouds') {
            rating = 100 - (value * 2);
        } else if (type === 'seeing') {
            rating = value < 50 ? (value * 2) - 100 : value;
        } else if (type === 'wind') {
            if (value <= 5) {
                rating = 100;
            } else if (value > 20) {
                rating = -100;
            } else {
                rating = 100 - ((value - 5) * 13.3);
            }
        } else if (type === 'humidity') {
            if (value <= 40) {
                rating = 100;
            } else if (value > 80) {
                rating = -100;
            } else {
                rating = 100 - ((value - 40) * 5);
            }
        }
        
        return Math.min(100, Math.max(-100, rating));
    }

    function getRatingClass(rating) {
        if (rating >= 80) return 'great';
        if (rating >= 50) return 'good';
        if (rating >= 0) return 'moderate';
        return 'poor';
    }

    function updateBar(type, value) {
        const rating = calculateRating(value, type);
        const ratingClass = getRatingClass(rating);
        const isWind = type === 'wind';
        const displayUnit = isWind ? 
            (currentUnits === 'imperial' ? ' mph' : ' km/h') : '%';
        const displayValue = isWind && currentUnits === 'imperial' ? 
            (value * 0.621371).toFixed(1) : value;

        const $ratingFill = $(`.rating-fill[data-type="${type}"]`);
        const $conditionBox = $ratingFill.closest('.condition-box');
        const circumference = 2 * Math.PI * 15.9155;
        
        const fillAmount = Math.abs(rating) / 100;
        const offset = circumference - (fillAmount * circumference);
        
        $ratingFill
            .removeClass('poor moderate good great')
            .addClass(ratingClass)
            .css('stroke-dasharray', `${circumference} ${circumference}`)
            .css('stroke-dashoffset', offset);
            
        const ratingDescriptor = rating >= 80 ? 'Great' : 
                                rating >= 50 ? 'Good' : 
                                rating >= 0 ? 'Marginal' : 'Poor';
        
        $conditionBox.find('.rating-value')
            .html(`${Math.round(Math.abs(rating))}<br><span class="rating-descriptor">${ratingDescriptor}</span>`);
        $conditionBox.find('.value').text(displayValue + displayUnit);
    }
    
    function updateWeather(lat, lon, date = null) {
        if (!date) date = $('.day-picker').val();
        
        $.ajax({
            url: astroWeather.ajaxurl,
            method: 'POST',
            data: {
                action: 'get_astro_weather',
                nonce: astroWeather.nonce,
                latitude: lat,
                longitude: lon,
                date: date
            },
            success: function(response) {
                if (response.success) {
                    weatherData = response.data.hourly;
                    
                    // Get the current value from the range slider and update everything
                    const slider = $('.time-slider')[0];
                    if (slider) {
                        updateSliderBackground(slider);
                        updateDisplayForHour(parseInt(slider.value));
                    }
                    
                    // Initialize timeline with the weather data
                    const timelineContainer = document.querySelector('.astro-weather-timeline');
                    if (timelineContainer) {
                        window.TimelineView.initializeTimeline(
                            timelineContainer,
                            weatherData,
                            currentUnits
                        );
                    }
                }
            }
        });
    }
    
    function updateDisplayForHour(hour) {
        if (!weatherData) return;
        
        const dateTime = new Date(weatherData.time[hour]);
        
        $('.time-display').text(
            dateTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            })
        );
        
        const isImperial = currentUnits === 'imperial';
        const temp = convertTemp(weatherData.temperature[hour], isImperial);
        const dewPoint = convertTemp(weatherData.dew_point[hour], isImperial);
        const unit = isImperial ? '°F' : '°C';
        
        updateBar('clouds', weatherData.clouds[hour]);
        updateBar('seeing', weatherData.seeing[hour]);
        updateBar('wind', weatherData.wind[hour]);
        updateBar('humidity', weatherData.humidity[hour]);
        
        $('.temp-value').text(temp.toFixed(1) + unit);
        $('.dew-value').text(dewPoint.toFixed(1) + unit);
    }

    function updateLocationDisplay(locationData) {
        const { lat, lon, display_name } = locationData;
        const locationParts = display_name.split(',');
        const cityDisplay = locationParts[0] + (locationParts[1] ? ',' + locationParts[1] : '');
        
        $('.current-location').text(cityDisplay);
        $('.coordinates').text(`${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);
    }
    
    // Event Handlers
    $('.day-picker').on('change', function() {
        const lat = $('.lat-input').val();
        const lon = $('.lon-input').val();
        if (lat && lon) {
            updateWeather(lat, lon, $(this).val());
        }
    });
    
    $('input[name="units"]').on('change', function() {
        currentUnits = $(this).val();
        updateDisplayForHour(parseInt($('.time-slider').val()));
    });
    
    $('.detect-location').on('click', function() {
        if (navigator.geolocation) {
            $(this).prop('disabled', true).text('Detecting...');
            
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                $.ajax({
                    url: `https://nominatim.openstreetmap.org/reverse`,
                    method: 'GET',
                    data: {
                        format: 'json',
                        lat: lat,
                        lon: lon
                    },
                    success: function(data) {
                        updateLocationDisplay({
                            lat,
                            lon,
                            display_name: data.display_name
                        });
                        updateWeather(lat, lon);
                        $('.lat-input').val(lat);
                        $('.lon-input').val(lon);
                    },
                    complete: function() {
                        $('.detect-location').prop('disabled', false)
                            .html('<i class="dashicons dashicons-location"></i> Detect My Location');
                    }
                });
            }, function(error) {
                alert('Error detecting location: ' + error.message);
                $('.detect-location').prop('disabled', false)
                    .html('<i class="dashicons dashicons-location"></i> Detect My Location');
            });
        }
    });
    
    $('.search-location').on('click', function() {
        const address = $('.address-input').val();
        if (!address) return;
        
        $(this).prop('disabled', true).text('Searching...');
        
        $.ajax({
            url: `https://nominatim.openstreetmap.org/search`,
            method: 'GET',
            data: {
                format: 'json',
                q: address,
                limit: 1
            },
            success: function(data) {
                if (data && data[0]) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    updateWeather(lat, lon);
                    $('.lat-input').val(lat);
                    $('.lon-input').val(lon);
                    updateLocationDisplay({
                        lat,
                        lon,
                        display_name: data[0].display_name
                    });
                } else {
                    alert('Location not found. Please try a different search term.');
                }
            },
            error: function() {
                alert('Error searching for location. Please try again.');
            },
            complete: function() {
                $('.search-location').prop('disabled', false).text('Search');
            }
        });
    });

    // Handle address input enter key
    $('.address-input').on('keypress', function(e) {
        if (e.which === 13) {
            $('.search-location').click();
        }
    });
    
    // Initialize with provided coordinates
    const lat = dashboard.find('.lat-input').val();
    const lon = dashboard.find('.lon-input').val();
    if (lat && lon) {
        updateWeather(lat, lon);
    }
});