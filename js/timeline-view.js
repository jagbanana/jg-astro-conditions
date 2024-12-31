// timeline-view.js
(function(window) {
    const TimelineView = function({ weatherData, currentUnits = 'metric' }) {
        const getColorForCondition = (value, type) => {
            const colors = {
                poor: 'rgba(255, 0, 0, 0.7)',    // Red with opacity
                moderate: 'rgba(255, 255, 0, 0.7)', // Yellow with opacity
                good: 'rgba(0, 255, 0, 0.7)',     // Green with opacity
                placeholder: 'rgba(128, 128, 128, 0.7)' // Gray with opacity
            };
            
            if (value === undefined) return colors.placeholder;

            let rating;
            if (type === 'clouds') {
                rating = Math.max(0, 100 - value);
            } else if (type === 'seeing') {
                rating = value;
            } else if (type === 'wind') {
                rating = Math.max(0, 100 - (value * 3));
            } else {
                rating = Math.max(0, 100 - value);
            }
            
            if (rating >= 75) return colors.good;
            if (rating >= 50) return colors.moderate;
            return colors.poor;
        };

        // Ensure we have exactly 168 hours of data
        const hourlyData = {
            time: Array(168).fill(undefined).map((_, index) => weatherData.time ? weatherData.time[index] : undefined),
            clouds: Array(168).fill(undefined).map((_, index) => weatherData.clouds ? weatherData.clouds[index] : undefined),
            seeing: Array(168).fill(undefined).map((_, index) => weatherData.seeing ? weatherData.seeing[index] : undefined),
            wind: Array(168).fill(undefined).map((_, index) => weatherData.wind ? weatherData.wind[index] : undefined),
            humidity: Array(168).fill(undefined).map((_, index) => weatherData.humidity ? weatherData.humidity[index] : undefined)
        };

        // Create condition rows with icons
        const icons = {
            clouds: '☁️',
            seeing: '👁️',
            wind: '💨',
            humidity: '💧'
        };

        const conditionRows = ['clouds', 'seeing', 'wind', 'humidity'].map(condition => 
            React.createElement('div', {
                key: condition,
                className: 'condition-row'
            }, [
                React.createElement('div', {
                    className: 'condition-header',
                    key: `${condition}-header`
                }, [
                    React.createElement('span', {
                        className: 'condition-icon',
                        key: `${condition}-icon`
                    }, icons[condition]),
                    React.createElement('span', {
                        className: 'condition-name',
                        key: `${condition}-label`
                    }, condition.charAt(0).toUpperCase() + condition.slice(1))
                ]),
                React.createElement('div', {
                    className: 'condition-bar',
                    key: `${condition}-bar`
                }, 
                    hourlyData.time.map((time, index) => {
                        const value = hourlyData[condition][index];
                        return React.createElement('div', {
                            key: index,
                            style: {
                                width: `${100/168}%`,
                                backgroundColor: getColorForCondition(value, condition)
                            },
                            className: 'hour-point',
                            title: `${new Date(time).toLocaleString()}\n${condition}: ${Math.round(value)}${condition === 'wind' ? ' km/h' : '%'}`
                        });
                    })
                )
            ])
        );

        // Create the date scale
        const dateScale = React.createElement('div', {
            className: 'date-scale',
            key: 'date-scale'
        }, [
            React.createElement('div', {
                className: 'date-labels',
                key: 'date-labels'
            }, 
                React.createElement('div', {
                    className: 'date-labels-container',
                    key: 'date-labels-container'
                },
                    Array.from({ length: 7 }).map((_, index) => {
                        const timeValue = hourlyData.time[index * 24];
                        const dateText = timeValue ? 
                            new Date(timeValue).toLocaleDateString('en-US', {
                                month: '2-digit',
                                day: '2-digit'
                            }) : 
                            '–';  // Using an en dash as placeholder
                        
                        return React.createElement('div', {
                            key: index,
                            className: 'date-label',
                            style: { width: `${100/7}%` }
                        }, dateText);
                    })
                )
            )
        ]);

        // Return the complete timeline view
        return React.createElement(
            'div',
            { className: 'astro-weather-timeline' },
            [
                React.createElement('div', {
                    className: 'timeline-title',
                    key: 'title'
                }, [
                    React.createElement('span', {key: 'title-text'}, '7-Day Overview')
                ]),
                React.createElement('div', {
                    className: 'timeline-content',
                    key: 'conditions-grid'
                }, conditionRows),
                dateScale,
                React.createElement('div', {
                    className: 'mt-2 text-xs text-gray-500',
                    key: 'help-text'
                }, 'Green indicates great astronomy conditions.')
            ]
        );
    };

    // Initialize timeline function
    function initializeTimeline(container, weatherData, units) {
        if (!container || !weatherData) {
            console.error('Missing required parameters for timeline initialization');
            return;
        }

        ReactDOM.render(
            React.createElement(TimelineView, {
                weatherData: weatherData,
                currentUnits: units
            }),
            container
        );
    }

    // Export to global scope
    window.TimelineView = {
        initializeTimeline: initializeTimeline
    };

})(window);