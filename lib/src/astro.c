/**
 * @file astro.c
 * @brief Swiss Ephemeris WebAssembly Interface
 * @version 2.0.0
 * @date 2024
 * 
 * @author Modified by astroahava kitty
 * 
 * This file provides a comprehensive WebAssembly interface to the Swiss Ephemeris
 * astronomical calculation library. It handles planetary positions, house systems,
 * nodes, apsides, and asteroid calculations with high precision.
 * 
 * @section features Key Features
 * - Complete astrological chart calculations
 * - Planetary position calculations (Sun through Pluto)
 * - House system calculations (Placidus, Koch, Whole Sign, etc.)
 * - Lunar and planetary nodes and apsides
 * - Asteroid position calculations (numbered asteroids)
 * - Multiple coordinate systems and reference frames
 * - JSON output format for easy JavaScript integration
 * 
 * @section functions Main Exported Functions
 * - _get(): Complete astrological chart (planets + houses + angles)
 * - _getPlanets(): Planetary positions only
 * - _getHouses(): House cusps and angles only
 * - _getPlanetaryNodes(): Nodes and apsides for all major planets
 * - _getSinglePlanetNodes(): Nodes and apsides for a single planet
 * - _getAsteroids(): Multiple asteroid positions by range
 * - _getSpecificAsteroids(): Specific asteroids by catalog numbers
 * - _getPlanet(): Single planet position
 * - _getJulianDay(): Julian Day calculation
 * - _degreesToDMS(): Degrees to DMS format conversion
 * - _freeMemory(): Memory management for allocated strings
 * 
 * @section coordinates Coordinate Systems
 * - All calculations use Swiss Ephemeris (SEFLG_SWIEPH)
 * - Positions are geocentric unless otherwise specified
 * - Ecliptic coordinates relative to mean ecliptic of date
 * - Tropical zodiac system (not sidereal)
 * - Longitude: 0-360° (Aries 0°-Pisces 30°)
 * - Latitude: -90° to +90° (negative = south)
 * 
 * @section precision Calculation Methods
 * For nodes and apsides, multiple calculation methods are supported:
 * - Method 0 (SE_NODBIT_MEAN): Mean elements for Sun-Neptune, osculating for Pluto+
 * - Method 1 (SE_NODBIT_OSCU): Osculating elements for all planets
 * - Method 2 (SE_NODBIT_OSCU_BAR): Barycentric osculating for outer planets
 * - Method 4 (SE_NODBIT_FOPOINT): Focal points instead of aphelia
 * 
 * @section accuracy Accuracy and Date Ranges
 * - Highest accuracy: 600-2400 CE
 * - Extended range: 3000 BCE - 3000 CE (reduced accuracy)
 * - Positions accurate to arc-seconds for major planets
 * - Houses depend on birth time accuracy
 * 
 * @section usage JavaScript Usage Examples
 * 
 * Basic chart calculation:
 * @code
 * // Complete birth chart for London, December 25, 2023, 12:00 PM
 * const resultPtr = Module._get(2023, 12, 25, 12, 0, 0, 0, 5, 30, "W", 51, 30, 0, "N", "P");
 * const result = Module.UTF8ToString(resultPtr);
 * const chartData = JSON.parse(result);
 * console.log(chartData.planets[0].name); // "Sun"
 * @endcode
 * 
 * Planetary nodes calculation:
 * @code
 * const nodesPtr = Module._getPlanetaryNodes(2023, 12, 25, 12, 0, 0, 1, 50000);
 * const nodesResult = Module.UTF8ToString(nodesPtr);
 * const nodesData = JSON.parse(nodesResult);
 * @endcode
 * 
 * Asteroid calculations:
 * @code
 * // Range of asteroids (1-100)
 * const asteroidsPtr = Module._getAsteroids(2023, 12, 25, 12, 0, 0, 1, 100, 100000);
 * const asteroidsResult = Module.UTF8ToString(asteroidsPtr);
 * const asteroidsData = JSON.parse(asteroidsResult);
 * 
 * // Specific asteroids by number
 * const listStr = "1,2,3,4,433,1566";
 * const strLen = Module.lengthBytesUTF8(listStr) + 1;
 * const strPtr = Module._malloc(strLen);
 * Module.stringToUTF8(listStr, strPtr, strLen);
 * const specificPtr = Module._getSpecificAsteroids(2023, 12, 25, 12, 0, 0, strPtr, 100000);
 * const specificResult = Module.UTF8ToString(specificPtr);
 * Module._free(strPtr);
 * @endcode
 * 
 * All functions return pointers to JSON strings that must be converted using Module.UTF8ToString().
 * Memory management is handled automatically by the WASM runtime for most cases.
 * 
 * @see Swiss Ephemeris documentation: https://www.astro.com/swisseph/
 */

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <math.h>
#include <emscripten.h>
#include "swephexp.h"

/**
 * @defgroup formatting Formatting Constants
 * @brief Constants for degree/time formatting
 * @{
 */
#define BIT_ROUND_SEC 1          /**< Round to nearest second */
#define BIT_ROUND_MIN 2          /**< Round to nearest minute */
#define BIT_ZODIAC 4             /**< Use zodiac sign format */
#define DEGREE_SYMBOL "°"        /**< Degree symbol for display */
/** @} */

/**
 * @defgroup buffer Buffer Size Constants
 * @brief Standard buffer sizes for different operations
 * @{
 */
#define CHART_BUFFER_SIZE 100000    /**< Complete chart calculation */
#define PLANETS_BUFFER_SIZE 50000   /**< Planets only */
#define HOUSES_BUFFER_SIZE 10000    /**< Houses only */
#define NODES_BUFFER_SIZE 50000     /**< Planetary nodes */
#define ASTEROIDS_BUFFER_SIZE 100000 /**< Multiple asteroids */
#define SINGLE_BUFFER_SIZE 1000     /**< Single object */
/** @} */

/**
 * @brief Zodiac sign abbreviations
 */
static const char *zodiac_signs[] = {
    "ar", "ta", "ge", "cn", "le", "vi",
    "li", "sc", "sa", "cp", "aq", "pi"
};

/**
 * @brief Escape special characters for JSON strings
 * @param src Source string to escape
 * @param dest Destination buffer for escaped string
 * @param dest_size Size of destination buffer
 */
static void escape_json_string(const char *src, char *dest, size_t dest_size)
{
    if (!src || !dest || dest_size < 2) {
        if (dest && dest_size > 0) dest[0] = '\0';
        return;
    }
    
    size_t src_len = strlen(src);
    size_t dest_idx = 0;
    
    for (size_t i = 0; i < src_len && dest_idx < dest_size - 1; i++) {
        char c = src[i];
        
        // Check if we have enough space for escape sequence
        if (dest_idx >= dest_size - 3) break;
        
        switch (c) {
            case '"':
                dest[dest_idx++] = '\\';
                dest[dest_idx++] = '"';
                break;
            case '\\':
                dest[dest_idx++] = '\\';
                dest[dest_idx++] = '\\';
                break;
            case '\n':
                dest[dest_idx++] = '\\';
                dest[dest_idx++] = 'n';
                break;
            case '\r':
                dest[dest_idx++] = '\\';
                dest[dest_idx++] = 'r';
                break;
            case '\t':
                dest[dest_idx++] = '\\';
                dest[dest_idx++] = 't';
                break;
            case '\b':
                dest[dest_idx++] = '\\';
                dest[dest_idx++] = 'b';
                break;
            case '\f':
                dest[dest_idx++] = '\\';
                dest[dest_idx++] = 'f';
                break;
            default:
                // Handle other control characters
                if (c >= 0 && c < 32) {
                    // Replace with space for safety
                    dest[dest_idx++] = ' ';
                } else {
                    dest[dest_idx++] = c;
                }
                break;
        }
    }
    
    dest[dest_idx] = '\0';
}

/**
 * @brief Convert decimal degrees to degrees/minutes/seconds format
 * 
 * @param degrees Decimal degrees to convert
 * @param format_flags Format flags (BIT_ROUND_MIN, BIT_ROUND_SEC, BIT_ZODIAC, SEFLG_EQUATORIAL)
 * @return Static string containing formatted degrees (overwritten on next call)
 * 
 * @example
 * @code
 * double longitude = 185.759;
 * printf("Position: %s\n", format_degrees(longitude, BIT_ZODIAC));
 * // Output: "Position: 5 li 45'32\""  (5° Libra 45'32")
 * @endcode
 */
static char *format_degrees(double degrees, int format_flags)
{
    static char result[50];
    const char *symbol = (format_flags & SEFLG_EQUATORIAL) ? "h" : "d";
    int sign = (degrees < 0) ? -1 : 1;
    
    // Handle negative values and normalize
    degrees = fabs(degrees);
    degrees = swe_degnorm(degrees);
    
    // Apply rounding
    if (format_flags & BIT_ROUND_MIN) degrees += 0.5 / 60.0;
    if (format_flags & BIT_ROUND_SEC) degrees += 0.5 / 3600.0;
    
    if (format_flags & BIT_ZODIAC) {
        // Zodiac format: "15 ar 30'45""
        int zodiac_index = (int)(degrees / 30.0);
        double sign_degrees = fmod(degrees, 30.0);
        int deg = (int)sign_degrees;
        int min = (int)((sign_degrees - deg) * 60.0);
        int sec = (int)(((sign_degrees - deg) * 60.0 - min) * 60.0);
        
        if (format_flags & BIT_ROUND_MIN) {
            snprintf(result, sizeof(result), "%2d %s %2d", deg, zodiac_signs[zodiac_index], min);
        } else if (format_flags & BIT_ROUND_SEC) {
            snprintf(result, sizeof(result), "%2d %s %2d'%2d", deg, zodiac_signs[zodiac_index], min, sec);
        } else {
            double frac_sec = ((sign_degrees - deg) * 60.0 - min) * 60.0 - sec;
            int frac = (int)(frac_sec * 10000);
            snprintf(result, sizeof(result), "%2d %s %2d'%2d.%04d", deg, zodiac_signs[zodiac_index], min, sec, frac);
        }
    } else {
        // Standard format: "185°45'32""
        int deg = (int)degrees;
        int min = (int)((degrees - deg) * 60.0);
        int sec = (int)(((degrees - deg) * 60.0 - min) * 60.0);
        
        if (format_flags & BIT_ROUND_MIN) {
            snprintf(result, sizeof(result), "%3d%s%2d'", deg, symbol, min);
        } else if (format_flags & BIT_ROUND_SEC) {
            snprintf(result, sizeof(result), "%3d%s%2d'%2d", deg, symbol, min, sec);
        } else {
            double frac_sec = ((degrees - deg) * 60.0 - min) * 60.0 - sec;
            int frac = (int)(frac_sec * 10000);
            snprintf(result, sizeof(result), "%3d%s%2d'%2d.%04d", deg, symbol, min, sec, frac);
        }
    }
    
    // Apply negative sign if needed
    if (sign < 0) {
        char *first_digit = strpbrk(result, "0123456789");
        if (first_digit && first_digit > result) {
            *(first_digit - 1) = '-';
        }
    }
    
    return result;
}

/**
 * @brief Calculate Julian Day from date/time components
 */
static double calculate_julian_day(int year, int month, int day, int hour, int minute, int second)
{
    double decimal_hour = hour + minute / 60.0 + second / 3600.0;
    return swe_julday(year, month, day, decimal_hour, SE_GREG_CAL);
}

/**
 * @brief Convert geographic coordinates to decimal degrees
 */
static void convert_coordinates(int deg, int min, int sec, const char *direction, double *result)
{
    *result = deg + min / 60.0 + sec / 3600.0;
    if (*direction == 'W' || *direction == 'S') {
        *result = -*result;
    }
}

/**
 * @brief Format planet data as JSON
 */
static int format_planet_json(char *buffer, int buffer_size, int planet_id, const char *name, 
                             double *coordinates, long flags, const char *error_msg, 
                             const char *separator)
{
    char escaped_name[100];
    char escaped_error[500];
    
    escape_json_string(name, escaped_name, sizeof(escaped_name));
    
    if (error_msg) {
        escape_json_string(error_msg, escaped_error, sizeof(escaped_error));
        return snprintf(buffer, buffer_size,
            " { \"index\": %d, \"name\": \"%s\", \"long\": 0.0, \"lat\": 0.0, "
            "\"distance\": 0.0, \"speed\": 0.0, \"long_s\": \"\", \"iflagret\": %ld, "
            "\"error\": true, \"error_msg\": \"%s\" }%s",
            planet_id, escaped_name, flags, escaped_error, separator);
    } else {
        return snprintf(buffer, buffer_size,
            " { \"index\": %d, \"name\": \"%s\", \"long\": %.6f, \"lat\": %.6f, "
            "\"distance\": %.9f, \"speed\": %.6f, \"long_s\": \"%s\", \"iflagret\": %ld, "
            "\"error\": false }%s",
            planet_id, escaped_name, coordinates[0], coordinates[1], coordinates[2], coordinates[3],
            format_degrees(coordinates[0], BIT_ZODIAC), flags, separator);
    }
}

/**
 * @brief Core astrological calculation function
 */
const char *astro(int year, int month, int day, int hour, int minute, int second, 
                  int lonG, int lonM, int lonS, char *lonEW, int latG, int latM, 
                  int latS, char *latNS, char *iHouse, int buflen)
{
    char planet_name[40], error_msg[AS_MAXCH];
    double julian_day, coordinates[6], longitude, latitude;
    double house_cusps[13], angles[10];  // house_cusps[0] unused, 1-12 are the cusps
    long calculation_flags, result_flags;
    
    char *buffer = malloc(buflen);
    int length = 0;
    
    // Initialize Swiss Ephemeris
    swe_set_ephe_path("eph");
    calculation_flags = SEFLG_SWIEPH | SEFLG_SPEED;
    
    // Calculate Julian Day
    julian_day = calculate_julian_day(year, month, day, hour, minute, second);
    
    // Begin JSON output
    length += snprintf(buffer + length, buflen - length,
        "{ \"initDate\": { \"year\": %d, \"month\": %d, \"day\": %d, "
        "\"hour\": %d, \"minute\": %d, \"second\": %d, \"jd_ut\": %.6f }, ",
        year, month, day, hour, minute, second, julian_day);
    
    // Calculate planetary positions
    length += snprintf(buffer + length, buflen - length, "\"planets\": [ ");
    
    for (int planet = SE_SUN; planet < SE_NPLANETS; planet++) {
        if (planet == SE_EARTH) continue; // Skip Earth in geocentric calculations
        
        const char *separator = (planet == SE_NPLANETS - 1) ? " " : ", ";
        result_flags = swe_calc_ut(julian_day, planet, calculation_flags, coordinates, error_msg);
        swe_get_planet_name(planet, planet_name);
        
        if (result_flags > 0 && (result_flags & SEFLG_SWIEPH)) {
            length += format_planet_json(buffer + length, buflen - length, 
                planet, planet_name, coordinates, result_flags, NULL, separator);
        } else {
            length += format_planet_json(buffer + length, buflen - length,
                planet, planet_name, NULL, result_flags, error_msg, separator);
        }
    }
    
    length += snprintf(buffer + length, buflen - length, "], ");
    
    // Convert and calculate house system
    convert_coordinates(lonG, lonM, lonS, lonEW, &longitude);
    convert_coordinates(latG, latM, latS, latNS, &latitude);
    
    swe_houses_ex(julian_day, calculation_flags, latitude, longitude, 
                  (int)*iHouse, house_cusps, angles);
    
    // Output angles (Ascendant and Midheaven)
    length += snprintf(buffer + length, buflen - length,
        "\"ascmc\": [ "
        "{ \"name\": \"Asc\", \"long\": %.6f, \"long_s\": \"%s\" }, "
        "{ \"name\": \"MC\", \"long\": %.6f, \"long_s\": \"%s\" } ], ",
        angles[0], format_degrees(angles[0], BIT_ZODIAC),
        angles[1], format_degrees(angles[1], BIT_ZODIAC));
    
    // Output house cusps
    length += snprintf(buffer + length, buflen - length, "\"houses\": [ ");
    for (int house = 1; house <= 12; house++) {
        const char *separator = (house == 12) ? " " : ", ";
        length += snprintf(buffer + length, buflen - length,
            "{ \"name\": \"%d\", \"long\": %.6f, \"long_s\": \"%s\" }%s ",
            house, house_cusps[house], format_degrees(house_cusps[house], BIT_ZODIAC), separator);
    }
    length += snprintf(buffer + length, buflen - length, "] }");
    
    return buffer;
}

/**
 * @brief Simple test function to verify WebAssembly exports
 */
EMSCRIPTEN_KEEPALIVE
const char *test()
{
    return "Swiss Ephemeris WASM v2.0 ready";
}

/**
 * @brief Complete astrological chart calculation
 */
EMSCRIPTEN_KEEPALIVE
const char *get(int year, int month, int day, int hour, int minute, int second, 
                int lonG, int lonM, int lonS, char *lonEW, int latG, int latM, 
                int latS, char *latNS, char *iHouse)
{
    return astro(year, month, day, hour, minute, second, lonG, lonM, lonS, lonEW, 
                 latG, latM, latS, latNS, iHouse, CHART_BUFFER_SIZE);
}

/**
 * @brief Calculate planetary nodes and apsides for all major planets
 */
EMSCRIPTEN_KEEPALIVE
const char *getPlanetaryNodes(int year, int month, int day, int hour, int minute, int second, int method, int buflen)
{
    char planet_name[40], error_msg[AS_MAXCH];
    double julian_day_ut, julian_day_et;
    double ascending_node[6], descending_node[6], perihelion[6], aphelion[6];
    long calculation_flags;
    int32 result;
    
    char *buffer = malloc(buflen);
    int length = 0;

    swe_set_ephe_path("eph");
    calculation_flags = SEFLG_SWIEPH | SEFLG_SPEED;

    julian_day_ut = calculate_julian_day(year, month, day, hour, minute, second);
    julian_day_et = julian_day_ut + swe_deltat_ex(julian_day_ut, calculation_flags, error_msg);

    length += snprintf(buffer + length, buflen - length,
        "{ \"initDate\": { \"year\": %d, \"month\": %d, \"day\": %d, "
        "\"hour\": %d, \"minute\": %d, \"second\": %d, \"jd_et\": %.6f }, "
        "\"method\": %d, \"nodes\": [ ",
        year, month, day, hour, minute, second, julian_day_et, method);

    // Calculate nodes for major planets (Sun through Pluto)
    for (int planet = SE_SUN; planet <= SE_PLUTO; planet++) {
        if (planet == SE_EARTH) continue; // Skip Earth
        
        const char *separator = (planet == SE_PLUTO) ? " " : ", ";

        // Initialize coordinate arrays
        memset(ascending_node, 0, sizeof(ascending_node));
        memset(descending_node, 0, sizeof(descending_node));
        memset(perihelion, 0, sizeof(perihelion));
        memset(aphelion, 0, sizeof(aphelion));

        result = swe_nod_aps(julian_day_et, planet, calculation_flags, method, 
                           ascending_node, descending_node, perihelion, aphelion, error_msg);
        swe_get_planet_name(planet, planet_name);

        // Escape strings for JSON
        char escaped_name[100];
        char escaped_error[500];
        escape_json_string(planet_name, escaped_name, sizeof(escaped_name));

        if (result >= 0) {
            length += snprintf(buffer + length, buflen - length,
                " { \"index\": %d, \"name\": \"%s\", "
                "\"ascending_node\": { \"long\": %.6f, \"lat\": %.6f, \"distance\": %.9f, "
                "\"speed_long\": %.6f, \"speed_lat\": %.6f, \"speed_dist\": %.9f, \"long_s\": \"%s\" }, "
                "\"descending_node\": { \"long\": %.6f, \"lat\": %.6f, \"distance\": %.9f, "
                "\"speed_long\": %.6f, \"speed_lat\": %.6f, \"speed_dist\": %.9f, \"long_s\": \"%s\" }, "
                "\"perihelion\": { \"long\": %.6f, \"lat\": %.6f, \"distance\": %.9f, "
                "\"speed_long\": %.6f, \"speed_lat\": %.6f, \"speed_dist\": %.9f, \"long_s\": \"%s\" }, "
                "\"aphelion\": { \"long\": %.6f, \"lat\": %.6f, \"distance\": %.9f, "
                "\"speed_long\": %.6f, \"speed_lat\": %.6f, \"speed_dist\": %.9f, \"long_s\": \"%s\" }, "
                "\"error\": false }%s",
                planet, escaped_name,
                ascending_node[0], ascending_node[1], ascending_node[2], ascending_node[3], ascending_node[4], ascending_node[5], 
                format_degrees(ascending_node[0], BIT_ZODIAC),
                descending_node[0], descending_node[1], descending_node[2], descending_node[3], descending_node[4], descending_node[5], 
                format_degrees(descending_node[0], BIT_ZODIAC),
                perihelion[0], perihelion[1], perihelion[2], perihelion[3], perihelion[4], perihelion[5], 
                format_degrees(perihelion[0], BIT_ZODIAC),
                aphelion[0], aphelion[1], aphelion[2], aphelion[3], aphelion[4], aphelion[5], 
                format_degrees(aphelion[0], BIT_ZODIAC),
                separator);
        } else {
            escape_json_string(error_msg, escaped_error, sizeof(escaped_error));
            length += snprintf(buffer + length, buflen - length,
                " { \"index\": %d, \"name\": \"%s\", \"error\": true, \"error_msg\": \"%s\" }%s",
                planet, escaped_name, escaped_error, separator);
        }
    }

    length += snprintf(buffer + length, buflen - length, "] }");
    return buffer;
}

/**
 * @brief Calculate nodes and apsides for a single planet
 */
EMSCRIPTEN_KEEPALIVE
const char *getSinglePlanetNodes(int planet_id, double julian_day_et, int method, int buflen)
{
    char planet_name[40], error_msg[AS_MAXCH];
    double ascending_node[6], descending_node[6], perihelion[6], aphelion[6];
    long calculation_flags;
    int32 result;
    char *buffer = malloc(buflen);

    swe_set_ephe_path("eph");
    calculation_flags = SEFLG_SWIEPH | SEFLG_SPEED;

    // Initialize coordinate arrays
    memset(ascending_node, 0, sizeof(ascending_node));
    memset(descending_node, 0, sizeof(descending_node));
    memset(perihelion, 0, sizeof(perihelion));
    memset(aphelion, 0, sizeof(aphelion));

    result = swe_nod_aps(julian_day_et, planet_id, calculation_flags, method, 
                        ascending_node, descending_node, perihelion, aphelion, error_msg);
    swe_get_planet_name(planet_id, planet_name);

    if (result >= 0) {
        snprintf(buffer, buflen,
            "{ \"index\": %d, \"name\": \"%s\", \"jd_et\": %.6f, \"method\": %d, "
            "\"ascending_node\": { \"long\": %.6f, \"lat\": %.6f, \"distance\": %.9f, "
            "\"speed_long\": %.6f, \"speed_lat\": %.6f, \"speed_dist\": %.9f, \"long_s\": \"%s\" }, "
            "\"descending_node\": { \"long\": %.6f, \"lat\": %.6f, \"distance\": %.9f, "
            "\"speed_long\": %.6f, \"speed_lat\": %.6f, \"speed_dist\": %.9f, \"long_s\": \"%s\" }, "
            "\"perihelion\": { \"long\": %.6f, \"lat\": %.6f, \"distance\": %.9f, "
            "\"speed_long\": %.6f, \"speed_lat\": %.6f, \"speed_dist\": %.9f, \"long_s\": \"%s\" }, "
            "\"aphelion\": { \"long\": %.6f, \"lat\": %.6f, \"distance\": %.9f, "
            "\"speed_long\": %.6f, \"speed_lat\": %.6f, \"speed_dist\": %.9f, \"long_s\": \"%s\" }, "
            "\"error\": false }",
            planet_id, planet_name, julian_day_et, method,
            ascending_node[0], ascending_node[1], ascending_node[2], ascending_node[3], ascending_node[4], ascending_node[5], 
            format_degrees(ascending_node[0], BIT_ZODIAC),
            descending_node[0], descending_node[1], descending_node[2], descending_node[3], descending_node[4], descending_node[5], 
            format_degrees(descending_node[0], BIT_ZODIAC),
            perihelion[0], perihelion[1], perihelion[2], perihelion[3], perihelion[4], perihelion[5], 
            format_degrees(perihelion[0], BIT_ZODIAC),
            aphelion[0], aphelion[1], aphelion[2], aphelion[3], aphelion[4], aphelion[5], 
            format_degrees(aphelion[0], BIT_ZODIAC));
    } else {
        snprintf(buffer, buflen,
            "{ \"index\": %d, \"name\": \"%s\", \"jd_et\": %.6f, \"method\": %d, "
            "\"error\": true, \"error_msg\": \"%s\" }",
            planet_id, planet_name, julian_day_et, method, error_msg);
    }

    return buffer;
}

/**
 * @brief Calculate positions for multiple asteroids
 * 
 * This function calculates positions for a list of asteroids using their catalog numbers.
 * Asteroids are numbered sequentially starting from 1 (Ceres), 2 (Pallas), 3 (Juno), etc.
 * The function can handle up to 1000 asteroids efficiently.
 * 
 * @param year Year (600-2400 for best accuracy)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @param hour Hour (0-23) in Universal Time
 * @param minute Minute (0-59)
 * @param second Second (0-59)
 * @param start_num Starting asteroid number (typically 1 for Ceres)
 * @param end_num Ending asteroid number (max 1000 recommended)
 * @param buflen Buffer length for output string (recommended: 100000+ for many asteroids)
 * 
 * @return JSON string containing:
 *   - initDate: Input date and calculated Julian Day UT
 *   - asteroid_range: Start and end numbers calculated
 *   - asteroids: Array of asteroid data with:
 *     - index: Asteroid catalog number
 *     - name: Asteroid name (if available)
 *     - long: Ecliptic longitude in degrees
 *     - lat: Ecliptic latitude in degrees
 *     - distance: Distance from Earth in AU
 *     - speed: Daily motion in longitude (degrees/day)
 *     - long_s: Formatted longitude string with zodiac sign
 *     - error: Boolean indicating calculation success
 *     - error_msg: Error message if calculation failed
 * 
 * @note Some asteroids may not be available in all ephemeris files.
 *       The function will mark these with error: true and continue with others.
 *       Positions are geocentric and use the same coordinate system as planets.
 * 
 * @example JavaScript usage:
 * // Calculate first 100 asteroids
 * const asteroids = Module.ccall('getAsteroids', 'string',
 *   ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
 *   [2023, 12, 25, 12, 0, 0, 1, 100, 50000]);
 * const data = JSON.parse(asteroids);
 * console.log(data.asteroids[0].name); // "Ceres"
 * Module.ccall('freeMemory', null, ['number'], [asteroids]);
 */
EMSCRIPTEN_KEEPALIVE
const char *getAsteroids(int year, int month, int day, int hour, int minute, int second, int start_num, int end_num, int buflen)
{
  char snam[40], serr[AS_MAXCH];
  double jut = 0.0;
  double tjd_ut, x[6];
  long iflag, iflagret;
  int ast_num;
  int round_flag = 0;
  char *Buffer = malloc(buflen);
  int length = 0;
  char *sChar = malloc(3);
  int calculated_count = 0;
  int error_count = 0;

  // Validate input range
  if (start_num < 1) start_num = 1;
  if (end_num > 1000) end_num = 1000;
  if (start_num > end_num) {
    int temp = start_num;
    start_num = end_num;
    end_num = temp;
  }

  swe_set_ephe_path("eph");
  iflag = SEFLG_SWIEPH | SEFLG_SPEED;

  jut = (double)hour + (double)minute / 60 + (double)second / 3600;
  tjd_ut = swe_julday(year, month, day, jut, SE_GREG_CAL);

  length += snprintf(Buffer + length, buflen - length, "{ ");
  length += snprintf(Buffer + length, buflen - length,
                     "\"initDate\": { \"year\": %d, \"month\": %d, \"day\": %d, \"hour\": %d, \"minute\": %d, \"second\": %d, \"jd_ut\": %f }, ", 
                     year, month, day, hour, minute, second, tjd_ut);

  length += snprintf(Buffer + length, buflen - length, 
                     "\"asteroid_range\": { \"start\": %d, \"end\": %d }, ", start_num, end_num);
  
  length += snprintf(Buffer + length, buflen - length, "\"asteroids\": [ ");

  for (ast_num = start_num; ast_num <= end_num; ast_num++)
  {
    strcpy(sChar, ", ");
    if (ast_num == end_num)
      strcpy(sChar, " ");

    // Initialize coordinate array
    for (int i = 0; i < 6; i++) {
      x[i] = 0.0;
    }

    // Calculate asteroid position
    // Asteroid numbers in Swiss Ephemeris are offset by SE_AST_OFFSET
    iflagret = swe_calc_ut(tjd_ut, SE_AST_OFFSET + ast_num, iflag, x, serr);

    // Try to get asteroid name
    swe_get_planet_name(SE_AST_OFFSET + ast_num, snam);
    
    // If no specific name found, use generic format
    if (strlen(snam) == 0 || strcmp(snam, "?") == 0) {
      snprintf(snam, sizeof(snam), "Asteroid_%d", ast_num);
    }

    // Escape strings for JSON
    char escaped_name[100];
    char escaped_error[500];
    escape_json_string(snam, escaped_name, sizeof(escaped_name));

    if (iflagret >= 0 && (iflagret & SEFLG_SWIEPH))
    {
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\", \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed\": %f, \"long_s\": \"%s\", \"iflagret\": %ld, \"error\": false }%s",
                         ast_num, escaped_name, x[0], x[1], x[2], x[3], format_degrees(x[0], round_flag | BIT_ZODIAC), iflagret, sChar);
      calculated_count++;
    }
    else
    {
      escape_json_string(serr, escaped_error, sizeof(escaped_error));
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\", \"long\": 0.0, \"lat\": 0.0, \"distance\": 0.0, \"speed\": 0.0, \"long_s\": \"\", \"iflagret\": %ld, \"error\": true, \"error_msg\": \"%s\" }%s",
                         ast_num, escaped_name, iflagret, escaped_error, sChar);
      error_count++;
    }

    // Check buffer space to prevent overflow
    if (length > buflen - 1000) {
      length += snprintf(Buffer + length, buflen - length,
                         " { \"warning\": \"Buffer limit reached, truncating results at asteroid %d\" } ", ast_num);
      break;
    }
  }

  length += snprintf(Buffer + length, buflen - length, "], ");
  length += snprintf(Buffer + length, buflen - length, 
                     "\"summary\": { \"calculated\": %d, \"errors\": %d, \"total_requested\": %d } }",
                     calculated_count, error_count, end_num - start_num + 1);

  free(sChar);
  return Buffer;
}

/**
 * @brief Calculate positions for specific asteroids by their catalog numbers
 * 
 * This function calculates positions for a specific list of asteroids identified
 * by their catalog numbers. More efficient than getAsteroids() when you only
 * need specific asteroids rather than a range.
 * 
 * @param year Year (600-2400)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @param hour Hour (0-23) in Universal Time
 * @param minute Minute (0-59)
 * @param second Second (0-59)
 * @param asteroid_list Comma-separated string of asteroid numbers (e.g., "1,2,3,4,433,1566")
 * @param buflen Buffer length for output string
 * 
 * @return JSON string with same format as getAsteroids()
 * 
 * @example JavaScript usage:
 * // Calculate specific asteroids: Ceres, Pallas, Juno, Vesta, Eros, Icarus
 * const asteroids = Module.ccall('getSpecificAsteroids', 'string',
 *   ['number', 'number', 'number', 'number', 'number', 'number', 'string', 'number'],
 *   [2023, 12, 25, 12, 0, 0, "1,2,3,4,433,1566", 20000]);
 */
EMSCRIPTEN_KEEPALIVE
const char *getSpecificAsteroids(int year, int month, int day, int hour, int minute, int second, char *asteroid_list, int buflen)
{
  char snam[40], serr[AS_MAXCH];
  double jut = 0.0;
  double tjd_ut, x[6];
  long iflag, iflagret;
  int round_flag = 0;
  char *Buffer = malloc(buflen);
  int length = 0;
  char *sChar = malloc(3);
  int calculated_count = 0;
  int error_count = 0;
  
  // Parse asteroid numbers from string
  int asteroid_numbers[1000]; // Maximum 1000 asteroids
  int num_asteroids = 0;
  char *token;
  char *list_copy = malloc(strlen(asteroid_list) + 1);
  strcpy(list_copy, asteroid_list);
  
  token = strtok(list_copy, ",");
  while (token != NULL && num_asteroids < 1000) {
    int ast_num = atoi(token);
    if (ast_num > 0 && ast_num <= 1000) {
      asteroid_numbers[num_asteroids++] = ast_num;
    }
    token = strtok(NULL, ",");
  }
  
  swe_set_ephe_path("eph");
  iflag = SEFLG_SWIEPH | SEFLG_SPEED;

  jut = (double)hour + (double)minute / 60 + (double)second / 3600;
  tjd_ut = swe_julday(year, month, day, jut, SE_GREG_CAL);

  length += snprintf(Buffer + length, buflen - length, "{ ");
  length += snprintf(Buffer + length, buflen - length,
                     "\"initDate\": { \"year\": %d, \"month\": %d, \"day\": %d, \"hour\": %d, \"minute\": %d, \"second\": %d, \"jd_ut\": %f }, ", 
                     year, month, day, hour, minute, second, tjd_ut);

  length += snprintf(Buffer + length, buflen - length, 
                     "\"requested_list\": \"%s\", ", asteroid_list);
  
  length += snprintf(Buffer + length, buflen - length, "\"asteroids\": [ ");

  for (int i = 0; i < num_asteroids; i++)
  {
    int ast_num = asteroid_numbers[i];
    
    strcpy(sChar, ", ");
    if (i == num_asteroids - 1)
      strcpy(sChar, " ");

    // Initialize coordinate array
    for (int j = 0; j < 6; j++) {
      x[j] = 0.0;
    }

    // Calculate asteroid position
    iflagret = swe_calc_ut(tjd_ut, SE_AST_OFFSET + ast_num, iflag, x, serr);

    // Try to get asteroid name
    swe_get_planet_name(SE_AST_OFFSET + ast_num, snam);
    
    if (strlen(snam) == 0 || strcmp(snam, "?") == 0) {
      snprintf(snam, sizeof(snam), "Asteroid_%d", ast_num);
    }

    // Escape strings for JSON
    char escaped_name[100];
    char escaped_error[500];
    escape_json_string(snam, escaped_name, sizeof(escaped_name));

    if (iflagret >= 0 && (iflagret & SEFLG_SWIEPH))
    {
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\", \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed\": %f, \"long_s\": \"%s\", \"iflagret\": %ld, \"error\": false }%s",
                         ast_num, escaped_name, x[0], x[1], x[2], x[3], format_degrees(x[0], round_flag | BIT_ZODIAC), iflagret, sChar);
      calculated_count++;
    }
    else
    {
      escape_json_string(serr, escaped_error, sizeof(escaped_error));
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\", \"long\": 0.0, \"lat\": 0.0, \"distance\": 0.0, \"speed\": 0.0, \"long_s\": \"\", \"iflagret\": %ld, \"error\": true, \"error_msg\": \"%s\" }%s",
                         ast_num, escaped_name, iflagret, escaped_error, sChar);
      error_count++;
    }

    // Check buffer space
    if (length > buflen - 1000) {
      length += snprintf(Buffer + length, buflen - length,
                         " { \"warning\": \"Buffer limit reached, truncating results\" } ");
      break;
    }
  }

  length += snprintf(Buffer + length, buflen - length, "], ");
  length += snprintf(Buffer + length, buflen - length, 
                     "\"summary\": { \"calculated\": %d, \"errors\": %d, \"total_requested\": %d } }",
                     calculated_count, error_count, num_asteroids);

  free(list_copy);
  free(sChar);
  return Buffer;
}

/**
 * @brief Set custom ephemeris path for selective loading
 * @param path Path to ephemeris files (default: "eph")
 * @return Success status
 */
EMSCRIPTEN_KEEPALIVE
int setEphemerisPath(char *path)
{
  swe_set_ephe_path(path);
  return 0;
}

/**
 * @brief Get ephemeris file information and availability
 * @param buflen Buffer length for output string
 * @return JSON string containing available ephemeris files and date ranges
 */
EMSCRIPTEN_KEEPALIVE
const char *getEphemerisInfo(int buflen)
{
  char *Buffer = malloc(buflen);
  int length = 0;
  
  length += snprintf(Buffer + length, buflen - length, "{ ");
  char path_buffer[256];
  length += snprintf(Buffer + length, buflen - length, 
                     "\"ephemeris_path\": \"%s\", ", swe_get_library_path(path_buffer));
  length += snprintf(Buffer + length, buflen - length,
                     "\"date_range\": { \"start\": \"0600-01-01\", \"end\": \"2400-01-01\" }, ");
  length += snprintf(Buffer + length, buflen - length,
                     "\"files_loaded\": \"VFS\", ");
  length += snprintf(Buffer + length, buflen - length,
                     "\"compression\": \"LZ4\" }");
  
  return Buffer;
}

/**
 * @brief Calculate planetary positions only (without houses)
 */
EMSCRIPTEN_KEEPALIVE
const char *getPlanets(int year, int month, int day, int hour, int minute, int second)
{
    char planet_name[40], error_msg[AS_MAXCH];
    double julian_day, coordinates[6];
    long calculation_flags, result_flags;
    
    char *buffer = malloc(PLANETS_BUFFER_SIZE);
    int length = 0;

    swe_set_ephe_path("eph");
    calculation_flags = SEFLG_SWIEPH | SEFLG_SPEED;
    julian_day = calculate_julian_day(year, month, day, hour, minute, second);

    length += snprintf(buffer + length, PLANETS_BUFFER_SIZE - length,
        "{ \"initDate\": { \"year\": %d, \"month\": %d, \"day\": %d, "
        "\"hour\": %d, \"minute\": %d, \"second\": %d, \"jd_ut\": %.6f }, "
        "\"planets\": [ ",
        year, month, day, hour, minute, second, julian_day);

    for (int planet = SE_SUN; planet < SE_NPLANETS; planet++) {
        if (planet == SE_EARTH) continue;
        
        const char *separator = (planet == SE_NPLANETS - 1) ? " " : ", ";
        result_flags = swe_calc_ut(julian_day, planet, calculation_flags, coordinates, error_msg);
        swe_get_planet_name(planet, planet_name);

        if (result_flags > 0 && (result_flags & SEFLG_SWIEPH)) {
            length += format_planet_json(buffer + length, PLANETS_BUFFER_SIZE - length,
                planet, planet_name, coordinates, result_flags, NULL, separator);
        } else {
            length += format_planet_json(buffer + length, PLANETS_BUFFER_SIZE - length,
                planet, planet_name, NULL, result_flags, error_msg, separator);
        }
    }

    length += snprintf(buffer + length, PLANETS_BUFFER_SIZE - length, "] }");
    return buffer;
}

/**
 * @brief Calculate house cusps and angles only (without planets)
 */
EMSCRIPTEN_KEEPALIVE
const char *getHouses(int year, int month, int day, int hour, int minute, int second, 
                     int lonG, int lonM, int lonS, char *lonEW, 
                     int latG, int latM, int latS, char *latNS, char *iHouse)
{
    double julian_day, longitude, latitude;
    double house_cusps[13], angles[10];
    long calculation_flags;
    
    char *buffer = malloc(HOUSES_BUFFER_SIZE);
    int length = 0;

    swe_set_ephe_path("eph");
    calculation_flags = SEFLG_SWIEPH | SEFLG_SPEED;
    julian_day = calculate_julian_day(year, month, day, hour, minute, second);

    convert_coordinates(lonG, lonM, lonS, lonEW, &longitude);
    convert_coordinates(latG, latM, latS, latNS, &latitude);

    swe_houses_ex(julian_day, calculation_flags, latitude, longitude, 
                  (int)*iHouse, house_cusps, angles);

    length += snprintf(buffer + length, HOUSES_BUFFER_SIZE - length,
        "{ \"initDate\": { \"year\": %d, \"month\": %d, \"day\": %d, "
        "\"hour\": %d, \"minute\": %d, \"second\": %d, \"jd_ut\": %.6f }, "
        "\"ascmc\": [ "
        "{ \"name\": \"Asc\", \"long\": %.6f, \"long_s\": \"%s\" }, "
        "{ \"name\": \"MC\", \"long\": %.6f, \"long_s\": \"%s\" } ], "
        "\"houses\": [ ",
        year, month, day, hour, minute, second, julian_day,
        angles[0], format_degrees(angles[0], BIT_ZODIAC),
        angles[1], format_degrees(angles[1], BIT_ZODIAC));

    for (int house = 1; house <= 12; house++) {
        const char *separator = (house == 12) ? " " : ", ";
        length += snprintf(buffer + length, HOUSES_BUFFER_SIZE - length,
            "{ \"name\": \"%d\", \"long\": %.6f, \"long_s\": \"%s\" }%s ",
            house, house_cusps[house], format_degrees(house_cusps[house], BIT_ZODIAC), separator);
    }
    
    length += snprintf(buffer + length, HOUSES_BUFFER_SIZE - length, "] }");
    return buffer;
}

/**
 * @brief Convert decimal degrees to degrees/minutes/seconds format
 */
EMSCRIPTEN_KEEPALIVE
const char *degreesToDMS(double degrees, int format)
{
    char *buffer = malloc(100);
    const char *result = format_degrees(degrees, format);
    strcpy(buffer, result);
    return buffer;
}

/**
 * @brief Calculate Julian Day for a given date/time
 */
EMSCRIPTEN_KEEPALIVE
const char *getJulianDay(int year, int month, int day, int hour, int minute, int second)
{
    double julian_day = calculate_julian_day(year, month, day, hour, minute, second);
    char *buffer = malloc(500);
    
    snprintf(buffer, 500,
        "{ \"year\": %d, \"month\": %d, \"day\": %d, \"hour\": %d, "
        "\"minute\": %d, \"second\": %d, \"julian_day\": %.6f }",
        year, month, day, hour, minute, second, julian_day);
    
    return buffer;
}

/**
 * @brief Calculate position for a single planet
 */
EMSCRIPTEN_KEEPALIVE
const char *getPlanet(int planet_id, int year, int month, int day, int hour, int minute, int second)
{
    char planet_name[40], error_msg[AS_MAXCH];
    double julian_day, coordinates[6];
    long calculation_flags, result_flags;
    char *buffer = malloc(SINGLE_BUFFER_SIZE);

    swe_set_ephe_path("eph");
    calculation_flags = SEFLG_SWIEPH | SEFLG_SPEED;
    julian_day = calculate_julian_day(year, month, day, hour, minute, second);

    result_flags = swe_calc_ut(julian_day, planet_id, calculation_flags, coordinates, error_msg);
    swe_get_planet_name(planet_id, planet_name);

    if (result_flags > 0 && (result_flags & SEFLG_SWIEPH)) {
        snprintf(buffer, SINGLE_BUFFER_SIZE,
            "{ \"index\": %d, \"name\": \"%s\", \"long\": %.6f, \"lat\": %.6f, "
            "\"distance\": %.9f, \"speed\": %.6f, \"long_s\": \"%s\", "
            "\"jd_ut\": %.6f, \"iflagret\": %ld, \"error\": false }",
            planet_id, planet_name, coordinates[0], coordinates[1], coordinates[2], coordinates[3],
            format_degrees(coordinates[0], BIT_ZODIAC), julian_day, result_flags);
    } else {
        snprintf(buffer, SINGLE_BUFFER_SIZE,
            "{ \"index\": %d, \"name\": \"%s\", \"long\": 0.0, \"lat\": 0.0, "
            "\"distance\": 0.0, \"speed\": 0.0, \"long_s\": \"\", \"jd_ut\": %.6f, "
            "\"iflagret\": %ld, \"error\": true, \"error_msg\": \"%s\" }",
            planet_id, planet_name, julian_day, result_flags, error_msg);
    }

    return buffer;
}

/**
 * @brief Free memory allocated by other functions
 */
EMSCRIPTEN_KEEPALIVE
void freeMemory(void *ptr)
{
    if (ptr) {
        free(ptr);
    }
}
