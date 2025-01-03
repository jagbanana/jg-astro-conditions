<?php
/**
 * Plugin Name: JGAstroConditions
 * Description: Display astronomy viewing conditions with a visual dashboard
 * Author: jaglab
 * Version: 0.36
 */

// Prevent direct access
if (!defined('ABSPATH')) exit;

// Define the plugin version in one place
define('ASTRO_WEATHER_VERSION', '0.36');

function init_astro_weather_timezone() {
    // Get WordPress timezone setting
    $timezone = get_option('timezone_string');
    if (empty($timezone)) {
        // If timezone string is empty, try offset
        $offset = get_option('gmt_offset');
        $timezone = timezone_name_from_abbr('', $offset * 3600, 0);
    }
    date_default_timezone_set($timezone);
}
add_action('init', 'init_astro_weather_timezone');

function register_astro_weather_scripts() {
    wp_enqueue_style(
        'astro-weather-styles',
        plugins_url('css/astro-weather.css', __FILE__),
        array(),
        ASTRO_WEATHER_VERSION
    );
    
    wp_enqueue_script(
        'astro-weather-script',
        plugins_url('js/astro-weather.js', __FILE__),
        array('jquery', 'jquery-ui-slider'),
        ASTRO_WEATHER_VERSION,
        true
    );

    wp_enqueue_style(
        'jquery-ui-css', 
        'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.css',
        array(),
        '1.12.1'
    );

        // Add React and ReactDOM
        wp_enqueue_script(
            'react',
            'https://cdnjs.cloudflare.com/ajax/libs/react/17.0.2/umd/react.production.min.js',
            array(),
            '17.0.2'
        );
        
        wp_enqueue_script(
            'react-dom',
            'https://cdnjs.cloudflare.com/ajax/libs/react-dom/17.0.2/umd/react-dom.production.min.js',
            array('react'),
            '17.0.2'
        );
        
        // Add lodash
        wp_enqueue_script(
            'lodash',
            'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
            array(),
            '4.17.21'
        );
    
        // Enqueue our timeline component
        wp_enqueue_script(
            'astro-weather-timeline',
            plugins_url('js/timeline-view.js', __FILE__),
            array('react', 'react-dom', 'lodash'),
            ASTRO_WEATHER_VERSION,
            true
        );

    wp_localize_script('astro-weather-script', 'astroWeather', array(
        'ajaxurl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('astro_weather_nonce'),
        'version' => ASTRO_WEATHER_VERSION
    ));
}
add_action('wp_enqueue_scripts', 'register_astro_weather_scripts');

/**
 * Calculate seeing conditions based on weather parameters
 */
function calculate_seeing_conditions($weather_data, $hour) {
    // Extract relevant parameters
    $temperature = $weather_data['hourly']['temperature'][$hour];
    $humidity = $weather_data['hourly']['humidity'][$hour];
    $wind_speed = $weather_data['hourly']['wind'][$hour];
    $dew_point = $weather_data['hourly']['dew_point'][$hour];
    
    // Calculate temperature difference from dew point
    // Larger differences generally indicate better seeing
    $temp_dew_diff = abs($temperature - $dew_point);
    $temp_score = min(100, max(0, 60 + ($temp_dew_diff * 2)));
    
    // Wind impact (optimal between 5-10 km/h, poor above 20 km/h)
    $wind_score = 100;
    if ($wind_speed < 5) {
        $wind_score = max(60, $wind_speed * 12);
    } else if ($wind_speed > 10) {
        $wind_score = max(0, 100 - (($wind_speed - 10) * 5));
    }
    
    // Humidity impact (better seeing with lower humidity)
    $humidity_score = max(0, 100 - ($humidity * 0.8));
    
    // Temperature stability score (based on rate of change)
    $temp_stability = 100;
    if ($hour > 0) {
        $temp_change = abs($temperature - $weather_data['hourly']['temperature'][$hour - 1]);
        $temp_stability = max(0, 100 - ($temp_change * 10));
    }
    
    // Combine scores with weighted importance
    $seeing_score = (
        ($temp_score * 0.3) +      // 30% weight for temperature-dew point difference
        ($wind_score * 0.3) +      // 30% weight for wind conditions
        ($humidity_score * 0.2) +   // 20% weight for humidity
        ($temp_stability * 0.2)     // 20% weight for temperature stability
    );
    
    // Return rounded score 0-100
    return round(min(100, max(0, $seeing_score)));
}

/**
 * Add seeing conditions to weather data
 */
function modify_weather_data($data) {
    $seeing_values = array();
    
    // Calculate seeing conditions for each hour
    for ($i = 0; $i < count($data['hourly']['time']); $i++) {
        $seeing_values[] = calculate_seeing_conditions($data, $i);
    }
    
    // Add seeing values to the weather data
    $data['hourly']['seeing'] = $seeing_values;
    
    return $data;
}

/**
 * AJAX handler for weather data
 */
function get_astro_weather_data() {
    check_ajax_referer('astro_weather_nonce', 'nonce');
    
    $latitude = floatval($_POST['latitude']);
    $longitude = floatval($_POST['longitude']);
    $start_date = sanitize_text_field($_POST['date']);
    $end_date = date('Y-m-d', strtotime($start_date . ' +6 days')); // Add 6 days to get a week
    
    $url = sprintf(
        'https://api.open-meteo.com/v1/forecast?latitude=%f&longitude=%f&hourly=temperature_2m,cloudcover,relative_humidity_2m,dew_point_2m,windspeed_10m&timezone=auto&start_date=%s&end_date=%s',
        $latitude,
        $longitude,
        $start_date,
        $end_date
    );
    
    $response = wp_remote_get($url);
    
    if (is_wp_error($response)) {
        wp_send_json_error('Failed to fetch weather data');
        return;
    }
    
    $body = json_decode(wp_remote_retrieve_body($response), true);
    
    // Format data structure
    $data = array(
        'hourly' => array(
            'clouds' => $body['hourly']['cloudcover'],
            'wind' => $body['hourly']['windspeed_10m'],
            'humidity' => $body['hourly']['relative_humidity_2m'],
            'temperature' => $body['hourly']['temperature_2m'],
            'dew_point' => $body['hourly']['dew_point_2m'],
            'time' => $body['hourly']['time']
        )
    );
    
    // Calculate real seeing conditions
    $data = modify_weather_data($data);
    
    wp_send_json_success($data);
}
add_action('wp_ajax_get_astro_weather', 'get_astro_weather_data');
add_action('wp_ajax_nopriv_get_astro_weather', 'get_astro_weather_data');

/**
 * Shortcode to display the astronomy weather conditions
 */
function astro_weather_dashboard_shortcode($atts) {
    $atts = shortcode_atts(array(
        'latitude' => '',
        'longitude' => ''
    ), $atts);
    
    ob_start();
    ?>
    <div class="astro-weather-dashboard">
        <div class="astro-weather-header">
            <h3><i class="dashicons dashicons-location"></i> Astronomy Conditions</h3>
            <div class="location-display">
                <span class="current-location">Location not set</span>
                <span class="coordinates"></span>
            </div>
            <!-- Location Controls -->
            <div class="location-controls">
                <div class="location-detect">
                    <button class="detect-location">
                        <i class="dashicons dashicons-location"></i>
                        Detect My Location
                    </button>
                    <p>or</p>
                </div>
                <div class="manual-location">
                    <div class="location-input-container">
                        <input type="text" class="address-input" placeholder="Enter city, address, or place name">
                        <div class="input-help">
                            <i class="dashicons dashicons-info"></i>
                            <div class="help-tooltip">
                                Enter a city name (e.g., "Portland, OR"), full address, or landmark name.
                                Press Enter or click Search when ready.
                            </div>
                        </div>
                    </div>
                    <button class="search-location">Search</button>
                </div>
            </div>
        </div>

        <section>
            <div class="container">
                <div class="row">
                    <!-- Left Column -->
                    <div class="col-md-6">
                        <div class="lc-block">
                            <!-- Time Controls -->
                            <div class="time-controls">
                                <div class="time-controls-top">
                                <select class="day-picker">
                                    <?php
                                    // In the shortcode function
                                        $today = current_time('Y-m-d'); // Use WordPress current_time instead of date()
                                        for ($i = 0; $i < 7; $i++) {
                                            $date = date('Y-m-d', strtotime("$today +$i days"));
                                            $display = date('l, M j', strtotime("$today +$i days"));
                                            
                                            if ($i == 0) {
                                                $display = "Today, " . date('M j', strtotime($today));
                                            } else if ($i == 1) {
                                                $display = "Tomorrow, " . date('M j', strtotime("$today +1 day"));
                                            }
                                            echo "<option value='$date'>$display</option>";
                                        }
                                    ?>
                                </select>
                                    <div class="units-toggle">
                                        <label>
                                            <input type="radio" name="units" value="metric" checked> °C
                                        </label>
                                        <label>
                                            <input type="radio" name="units" value="imperial"> °F
                                        </label>
                                    </div>
                                </div>
                                <div class="time-slider-container">
                                    <div class="time-slider"></div>
                                    <div class="time-display"></div>
                                </div>
                            </div>

                            <!-- Conditions Grid -->
                            <div class="conditions-grid">
                                <?php foreach ([
                                    ['Cloud Cover', 'clouds', 'cloud', true],
                                    ['Seeing', 'seeing', 'visibility', false],
                                    ['Wind', 'wind', 'controls-play', true],
                                    ['Humidity', 'humidity', 'water', true]
                                ] as [$label, $type, $icon, $inverted]): ?>
                                <div class="condition-box">
                                    <div class="condition-header">
                                        <div class="condition-label">
                                            <i class="dashicons dashicons-<?php echo $icon; ?>"></i>
                                            <span><?php echo $label; ?></span>
                                        </div>
                                        <div class="condition-value">
                                            <span class="value">--</span>
                                        </div>
                                    </div>
                                    <div class="condition-rating">
                                        <div class="rating-dial">
                                            <svg viewBox="0 0 36 36">
                                                <path class="rating-bg" d="M18 2.0845
                                                    a 15.9155 15.9155 0 0 1 0 31.831
                                                    a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                <path class="rating-fill" data-inverted="<?php echo $inverted ? 'true' : 'false'; ?>"
                                                      data-type="<?php echo $type; ?>" d="M18 2.0845
                                                    a 15.9155 15.9155 0 0 1 0 31.831
                                                    a 15.9155 15.9155 0 0 1 0 -31.831" />
                                            </svg>
                                            <span class="rating-value">--</span>
                                        </div>
                                    </div>
                                </div>
                                <?php endforeach; ?>
                            </div>

                            <!-- Metrics Grid -->
                            <div class="metrics-grid">
                                <div class="metric">
                                    <i class="dashicons dashicons-thermometer"></i>
                                    <span>Temperature</span>
                                    <span class="temp-value">--°C</span>
                                </div>
                                <div class="metric">
                                    <i class="dashicons dashicons-water"></i>
                                    <span>Dew Point</span>
                                    <span class="dew-value">--°C</span>
                                </div>
                            </div>

                            <!-- Info Section -->
                            <div class="astro-weather-info">
                                <p>Ratings indicate viewing conditions:</p>
                                <span class="rating-legend poor mb-1">Poor</span> 
                                <span class="rating-legend moderate mb-1">Marginal</span>
                                <span class="rating-legend good mb-1">Good</span>
                                <span class="rating-legend great mb-1">Great</span>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column -->
                    <div class="col-md-6">
                        <div class="lc-block">
                            <!-- Timeline View -->
                            <div class="astro-weather-timeline"></div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <input type="hidden" class="lat-input" value="<?php echo esc_attr($atts['latitude']); ?>">
        <input type="hidden" class="lon-input" value="<?php echo esc_attr($atts['longitude']); ?>">
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('astro_weather_dashboard', 'astro_weather_dashboard_shortcode');