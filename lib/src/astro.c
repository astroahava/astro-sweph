/**
 * @preserve Copyright (c) 2018-2022 NN Solex, www.sublunar.space
 * License MIT: http://www.opensource.org/licenses/MIT
 */

/**
 * @brief Modified by u-blusky Swep-Wasm
 * Modified by astroahava kitty
 * 
 * This file contains astronomical calculation functions for the Swiss Ephemeris WebAssembly port.
 * It provides functions to calculate planetary positions, houses, and nodes/apsides.
 * 
 * Main exported functions:
 * - get(): Complete astrological chart calculation (planets, houses, angles)
 * - getPlanets(): Planetary positions only
 * - getHouses(): House cusps and angles only  
 * - degreesToDMS(): Convert decimal degrees to degrees/minutes/seconds
 * - getJulianDay(): Calculate Julian Day for a date/time
 * - getPlanet(): Single planet position calculation
 * - getPlanetaryNodes(): Calculate nodes and apsides for all major planets
 * - getSinglePlanetNodes(): Calculate nodes and apsides for a single planet
 * - freeMemory(): Free allocated memory
 * 
 * Coordinate systems and reference frames:
 * - All calculations use the Swiss Ephemeris (SEFLG_SWIEPH)
 * - Positions are geocentric unless otherwise specified
 * - Ecliptic coordinates are relative to mean ecliptic of date
 * - Zodiacal positions are tropical (not sidereal)
 * 
 * Node and apside calculation methods:
 * - Method 0 (SE_NODBIT_MEAN): Mean elements for Sun-Neptune, osculating for Pluto+
 * - Method 1 (SE_NODBIT_OSCU): Osculating elements for all planets
 * - Method 2 (SE_NODBIT_OSCU_BAR): Barycentric osculating elements for outer planets
 * - Method 4 (SE_NODBIT_FOPOINT): Calculate focal points instead of aphelia
 * 
 * All functions return JSON-formatted strings for easy JavaScript integration.
 */

#define ONLINE 1
#define OFFLINE 2

#ifndef USECASE
#define USECASE OFFLINE
#endif

#include <stdlib.h>
#include <stdio.h>
#include <time.h>
#include <math.h>
#include "swephexp.h"

#if USECASE == OFFLINE
#include <emscripten.h>
#endif

#define MY_ODEGREE_STRING "°"
#define BIT_ROUND_SEC 1
#define BIT_ROUND_MIN 2
#define BIT_ZODIAC 4
#define PLSEL_D "0123456789mtABC"
#define PLSEL_P "0123456789mtABCDEFGHI"
#define PLSEL_H "JKLMNOPQRSTUVWX"
#define PLSEL_A "0123456789mtABCDEFGHIJKLMNOPQRSTUVWX"

static char *zod_nam[] = {"ar", "ta", "ge", "cn", "le", "vi",
                          "li", "sc", "sa", "cp", "aq", "pi"};

// static char *dms(double x, long iflag) code from sweph
static char *dms(double x, long iflag)
{
  int izod;
  long k, kdeg, kmin, ksec;
  char *c = MY_ODEGREE_STRING;
  char *sp, s1[50];
  static char s[50];
  int sgn;
  *s = '\0';
  if (iflag & SEFLG_EQUATORIAL)
    strcpy(c, "h");
  if (x < 0)
  {
    x = -x;
    sgn = -1;
  }
  else
    sgn = 1;
  if (iflag & BIT_ROUND_MIN)
    x += 0.5 / 60;
  if (iflag & BIT_ROUND_SEC)
    x += 0.5 / 3600;
  if (iflag & BIT_ZODIAC)
  {
    izod = (int)(x / 30);
    x = fmod(x, 30);
    kdeg = (long)x;
    sprintf(s, "%2ld %s ", kdeg, zod_nam[izod]);
  }
  else
  {
    kdeg = (long)x;
    sprintf(s, " %3ld%s", kdeg, c);
  }
  x -= kdeg;
  x *= 60;
  kmin = (long)x;
  if ((iflag & BIT_ZODIAC) && (iflag & BIT_ROUND_MIN))
    sprintf(s1, "%2ld", kmin);
  else
    sprintf(s1, "%2ld'", kmin);
  strcat(s, s1);
  if (iflag & BIT_ROUND_MIN)
    goto return_dms;
  x -= kmin;
  x *= 60;
  ksec = (long)x;
  if (iflag & BIT_ROUND_SEC)
    sprintf(s1, "%2ld\"", ksec);
  else
    sprintf(s1, "%2ld", ksec);
  strcat(s, s1);
  if (iflag & BIT_ROUND_SEC)
    goto return_dms;
  x -= ksec;
  k = (long)(x * 10000);
  sprintf(s1, ".%04ld", k);
  strcat(s, s1);
return_dms:;
  if (sgn < 0)
  {
    sp = strpbrk(s, "0123456789");
    *(sp - 1) = '-';
  }
  return (s);
}

const char *astro(int year, int month, int day, int hour, int minute, int second, int lonG, int lonM, int lonS, char *lonEW, int latG, int latM, int latS, char *latNS, char *iHouse, int buflen)
{
  char snam[40], serr[AS_MAXCH];
  double jut = 0.0;
  double tjd_ut, x[6], lon, lat;
  double cusp[12 + 1];
  double ascmc[10];
  long iflag, iflagret;
  int p, i;
  int round_flag = 0;
  char *Buffer = malloc(buflen);
  int length = 0;
  char *sChar = malloc(3);

  swe_set_ephe_path("eph");
  iflag = SEFLG_SWIEPH | SEFLG_SPEED;

  jut = (double)hour + (double)minute / 60 + (double)second / 3600;
  tjd_ut = swe_julday(year, month, day, jut, SE_GREG_CAL);

  length += snprintf(Buffer + length, buflen - length, "{ ");

  length += snprintf(Buffer + length, buflen - length,
                     "\"initDate\":[{ \"year\": %d, \"month\": %d,  \"day\": %d,  \"hour\": %d, \"minute\": %d, \"second\": %d, \"jd_ut\": %f }], ", year, month, day, hour, minute, second, tjd_ut);

  length += snprintf(Buffer + length, buflen - length, "\"planets\":[ ");

  for (p = SE_SUN; p < SE_NPLANETS; p++)
  {
    if (p == SE_EARTH)
      continue;
    strcpy(sChar, ", ");
    if (p == SE_NPLANETS - 1)
      strcpy(sChar, " ");

    iflagret = swe_calc_ut(tjd_ut, p, iflag, x, serr);

    if (iflagret > 0 && (iflagret & SEFLG_SWIEPH))
    {
      swe_get_planet_name(p, snam);
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\",  \"long\": %f,  \"lat\": %f, \"distance\": %f, \"speed\": %f, \"long_s\": \"%s\", \"iflagret\": %ld, \"error\": %d }%s", p, snam, x[0], x[1], x[2], x[3], dms(x[0], round_flag | BIT_ZODIAC), iflagret, 0, sChar);
    }
    else
    {
      swe_get_planet_name(p, snam);
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\",  \"long\": %f,  \"lat\": %f, \"distance\": %f, \"speed\": %f, \"long_s\": \"%s\", \"iflagret\": %ld, \"error\": %d }%s", p, snam, 0.0, 0.0, 0.0, 0.0, "", iflagret, 1, sChar);
    }
  }

  length += snprintf(Buffer + length, buflen - length, "], ");

  lon = lonG + lonM / 60.0 + lonS / 3600.0;
  if (*lonEW == 'W')
    lon = -lon;
  lat = latG + latM / 60.0 + latS / 3600.0;
  if (*latNS == 'S')
    lat = -lat;

  swe_houses_ex(tjd_ut, iflag, lat, lon, (int)*iHouse, cusp, ascmc);
  length += snprintf(Buffer + length, buflen - length, "\"ascmc\":[ ");
  length += snprintf(Buffer + length, buflen - length,
                     "{ \"name\": \"%s\",  \"long\": %f,  \"long_s\": \"%s\" }, ", "Asc", ascmc[0], dms(ascmc[0], round_flag | BIT_ZODIAC));
  length += snprintf(Buffer + length, buflen - length,
                     " { \"name\": \"%s\",  \"long\": %f,  \"long_s\": \"%s\" } ", "MC", ascmc[1], dms(ascmc[1], round_flag | BIT_ZODIAC));
  length += snprintf(Buffer + length, buflen - length, "], ");

  length += snprintf(Buffer + length, buflen - length, "\"house\":[ ");
  for (i = 1; i <= 12; i++)
  {
    strcpy(sChar, ", ");
    if (i == 12)
      strcpy(sChar, " ");
    length += snprintf(Buffer + length, buflen - length,
                       " { \"name\": \"%d\",  \"long\": %f,  \"long_s\": \"%s\" }%s ", i, cusp[i], dms(cusp[i], round_flag | BIT_ZODIAC), sChar);
  }
  length += snprintf(Buffer + length, buflen - length, "]}");
  return Buffer;
}

#if USECASE == OFFLINE

/**
 * @brief Simple test function to verify exports are working
 * @return Test string
 */
EMSCRIPTEN_KEEPALIVE
const char *test()
{
  return "Test function works!";
}

/**
 * @brief Main astrological chart calculation function
 * @param year Year (1800-2400)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @param hour Hour (0-23)
 * @param minute Minute (0-59)
 * @param second Second (0-59)
 * @param lonG Longitude degrees
 * @param lonM Longitude minutes
 * @param lonS Longitude seconds
 * @param lonEW Longitude direction ("E" or "W")
 * @param latG Latitude degrees
 * @param latM Latitude minutes
 * @param latS Latitude seconds
 * @param latNS Latitude direction ("N" or "S")
 * @param iHouse House system character (P=Placidus, K=Koch, etc.)
 * @return JSON string containing complete astrological chart data
 */
EMSCRIPTEN_KEEPALIVE
const char *get(int year, int month, int day, int hour, int minute, int second, int lonG, int lonM, int lonS, char *lonEW, int latG, int latM, int latS, char *latNS, char *iHouse)
{
  int32 buflen;
  buflen = 100000;
  return astro(year, month, day, hour, minute, second, lonG, lonM, lonS, lonEW, latG, latM, latS, latNS, iHouse, buflen);
}

/**
 * @brief Calculate planetary nodes and apsides for all major planets
 * 
 * This function calculates the ascending/descending nodes and perihelion/aphelion
 * points for all major planets (Sun through Pluto) using the Swiss Ephemeris.
 * Earth is skipped as it doesn't have meaningful heliocentric nodes.
 * 
 * Nodes represent the intersection points of a planet's orbital plane with the
 * ecliptic plane. Apsides represent the closest (perihelion) and farthest 
 * (aphelion) points in the planet's orbit.
 * 
 * @param year Year (1800-2400 for best accuracy)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @param hour Hour (0-23) in Universal Time
 * @param minute Minute (0-59)
 * @param second Second (0-59)
 * @param method Calculation method:
 *   - 0 (SE_NODBIT_MEAN): Mean elements for Sun-Neptune, osculating for Pluto+
 *   - 1 (SE_NODBIT_OSCU): Osculating elements for all planets
 *   - 2 (SE_NODBIT_OSCU_BAR): Barycentric osculating elements for outer planets
 *   - 4 (SE_NODBIT_FOPOINT): Focal points instead of aphelia (combinable)
 * @param buflen Buffer length for output string (recommended: 50000+)
 * 
 * @return JSON string containing:
 *   - initDate: Input date and calculated Julian Day ET
 *   - method: Calculation method used
 *   - nodes: Array of planet data with:
 *     - index: Planet number (0=Sun, 1=Moon, etc.)
 *     - name: Planet name
 *     - ascending_node: Longitude, latitude, distance, speeds, formatted string
 *     - descending_node: Same format as ascending_node
 *     - perihelion: Closest point to Sun
 *     - aphelion: Farthest point from Sun (or focal point if method & 4)
 *     - error: Boolean indicating calculation success
 * 
 * @note Coordinates are in degrees (longitude/latitude) and AU (distance).
 *       Speeds are in degrees/day and AU/day.
 *       Remember to free the returned pointer with freeMemory() in JavaScript.
 * 
 * @example JavaScript usage:
 * const nodes = Module.ccall('getPlanetaryNodes', 'string',
 *   ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
 *   [2023, 12, 25, 12, 0, 0, 0, 50000]);
 * const data = JSON.parse(nodes);
 * console.log(data.nodes[3].name); // "Mars"
 * Module.ccall('freeMemory', null, ['number'], [nodes]);
 */
EMSCRIPTEN_KEEPALIVE
const char *getPlanetaryNodes(int year, int month, int day, int hour, int minute, int second, int method, int buflen)
{
  char snam[40], serr[AS_MAXCH];
  double jut = 0.0;
  double tjd_et, tjd_ut;
  double xnasc[6], xndsc[6], xperi[6], xaphe[6];
  long iflag;
  int32 retval;
  int p;
  int round_flag = 0;
  char *Buffer = malloc(buflen);
  int length = 0;
  char *sChar = malloc(3);

  swe_set_ephe_path("eph");
  iflag = SEFLG_SWIEPH | SEFLG_SPEED;

  jut = (double)hour + (double)minute / 60 + (double)second / 3600;
  tjd_ut = swe_julday(year, month, day, jut, SE_GREG_CAL);
  tjd_et = tjd_ut + swe_deltat_ex(tjd_ut, iflag, serr);

  length += snprintf(Buffer + length, buflen - length, "{ ");
  length += snprintf(Buffer + length, buflen - length,
                     "\"initDate\": { \"year\": %d, \"month\": %d, \"day\": %d, \"hour\": %d, \"minute\": %d, \"second\": %d, \"jd_et\": %f }, ", 
                     year, month, day, hour, minute, second, tjd_et);

  length += snprintf(Buffer + length, buflen - length, "\"method\": %d, ", method);
  length += snprintf(Buffer + length, buflen - length, "\"nodes\": [ ");

  // Calculate nodes for major planets (Sun through Pluto)
  for (p = SE_SUN; p <= SE_PLUTO; p++)
  {
    if (p == SE_EARTH) continue; // Skip Earth as it doesn't have meaningful nodes in heliocentric system
    
    strcpy(sChar, ", ");
    if (p == SE_PLUTO)
      strcpy(sChar, " ");

    // Initialize arrays
    for (int i = 0; i < 6; i++) {
      xnasc[i] = xndsc[i] = xperi[i] = xaphe[i] = 0.0;
    }

    retval = swe_nod_aps(tjd_et, p, iflag, method, xnasc, xndsc, xperi, xaphe, serr);

    swe_get_planet_name(p, snam);

    if (retval >= 0) {
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\", "
                         "\"ascending_node\": { \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed_long\": %f, \"speed_lat\": %f, \"speed_dist\": %f, \"long_s\": \"%s\" }, "
                         "\"descending_node\": { \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed_long\": %f, \"speed_lat\": %f, \"speed_dist\": %f, \"long_s\": \"%s\" }, "
                         "\"perihelion\": { \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed_long\": %f, \"speed_lat\": %f, \"speed_dist\": %f, \"long_s\": \"%s\" }, "
                         "\"aphelion\": { \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed_long\": %f, \"speed_lat\": %f, \"speed_dist\": %f, \"long_s\": \"%s\" }, "
                         "\"error\": false }%s",
                         p, snam,
                         xnasc[0], xnasc[1], xnasc[2], xnasc[3], xnasc[4], xnasc[5], dms(xnasc[0], round_flag | BIT_ZODIAC),
                         xndsc[0], xndsc[1], xndsc[2], xndsc[3], xndsc[4], xndsc[5], dms(xndsc[0], round_flag | BIT_ZODIAC),
                         xperi[0], xperi[1], xperi[2], xperi[3], xperi[4], xperi[5], dms(xperi[0], round_flag | BIT_ZODIAC),
                         xaphe[0], xaphe[1], xaphe[2], xaphe[3], xaphe[4], xaphe[5], dms(xaphe[0], round_flag | BIT_ZODIAC),
                         sChar);
    } else {
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\", \"error\": true, \"error_msg\": \"%s\" }%s",
                         p, snam, serr, sChar);
    }
  }

  length += snprintf(Buffer + length, buflen - length, "] }");
  free(sChar);
  return Buffer;
}

/**
 * @brief Calculate nodes and apsides for a single planet
 * 
 * This function calculates the nodes and apsides for a single specified planet
 * using Julian Day in Ephemeris Time (ET). More efficient than getPlanetaryNodes()
 * when only one planet is needed.
 * 
 * @param planet_id Planet number:
 *   - 0: Sun, 1: Moon, 2: Mercury, 3: Venus, 4: Mars
 *   - 5: Jupiter, 6: Saturn, 7: Uranus, 8: Neptune, 9: Pluto
 * @param julian_day_et Julian Day in Ephemeris Time (TT)
 * @param method Calculation method (see getPlanetaryNodes() for details)
 * @param buflen Buffer length for output string (recommended: 5000+)
 * 
 * @return JSON string containing:
 *   - index: Planet number
 *   - name: Planet name
 *   - jd_et: Julian Day ET used for calculation
 *   - method: Calculation method
 *   - ascending_node, descending_node, perihelion, aphelion: Same format as getPlanetaryNodes()
 *   - error: Boolean indicating calculation success
 * 
 * @note Use swe_julday() or getJulianDay() to convert calendar date to Julian Day.
 *       Add Delta T to get Julian Day ET from Julian Day UT.
 * 
 * @example JavaScript usage:
 * const jd_et = 2460310.0; // Approximate JD for 2024-01-01
 * const marsNodes = Module.ccall('getSinglePlanetNodes', 'string',
 *   ['number', 'number', 'number', 'number'],
 *   [4, jd_et, 1, 5000]); // Mars, JD, osculating method, buffer size
 */
EMSCRIPTEN_KEEPALIVE
const char *getSinglePlanetNodes(int planet_id, double julian_day_et, int method, int buflen)
{
  char snam[40], serr[AS_MAXCH];
  double xnasc[6], xndsc[6], xperi[6], xaphe[6];
  long iflag;
  int32 retval;
  int round_flag = 0;
  char *Buffer = malloc(buflen);

  swe_set_ephe_path("eph");
  iflag = SEFLG_SWIEPH | SEFLG_SPEED;

  // Initialize arrays
  for (int i = 0; i < 6; i++) {
    xnasc[i] = xndsc[i] = xperi[i] = xaphe[i] = 0.0;
  }

  retval = swe_nod_aps(julian_day_et, planet_id, iflag, method, xnasc, xndsc, xperi, xaphe, serr);
  swe_get_planet_name(planet_id, snam);

  if (retval >= 0) {
    snprintf(Buffer, buflen,
             "{ \"index\": %d, \"name\": \"%s\", \"jd_et\": %f, \"method\": %d, "
             "\"ascending_node\": { \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed_long\": %f, \"speed_lat\": %f, \"speed_dist\": %f, \"long_s\": \"%s\" }, "
             "\"descending_node\": { \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed_long\": %f, \"speed_lat\": %f, \"speed_dist\": %f, \"long_s\": \"%s\" }, "
             "\"perihelion\": { \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed_long\": %f, \"speed_lat\": %f, \"speed_dist\": %f, \"long_s\": \"%s\" }, "
             "\"aphelion\": { \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed_long\": %f, \"speed_lat\": %f, \"speed_dist\": %f, \"long_s\": \"%s\" }, "
             "\"error\": false }",
             planet_id, snam, julian_day_et, method,
             xnasc[0], xnasc[1], xnasc[2], xnasc[3], xnasc[4], xnasc[5], dms(xnasc[0], round_flag | BIT_ZODIAC),
             xndsc[0], xndsc[1], xndsc[2], xndsc[3], xndsc[4], xndsc[5], dms(xndsc[0], round_flag | BIT_ZODIAC),
             xperi[0], xperi[1], xperi[2], xperi[3], xperi[4], xperi[5], dms(xperi[0], round_flag | BIT_ZODIAC),
             xaphe[0], xaphe[1], xaphe[2], xaphe[3], xaphe[4], xaphe[5], dms(xaphe[0], round_flag | BIT_ZODIAC));
  } else {
    snprintf(Buffer, buflen,
             "{ \"index\": %d, \"name\": \"%s\", \"jd_et\": %f, \"method\": %d, \"error\": true, \"error_msg\": \"%s\" }",
             planet_id, snam, julian_day_et, method, serr);
  }

  return Buffer;
}

/**
 * @brief Calculate positions for multiple asteroids
 * 
 * This function calculates positions for a list of asteroids using their catalog numbers.
 * Asteroids are numbered sequentially starting from 1 (Ceres), 2 (Pallas), 3 (Juno), etc.
 * The function can handle up to 1000 asteroids efficiently.
 * 
 * @param year Year (1800-2400 for best accuracy)
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

    if (iflagret >= 0 && (iflagret & SEFLG_SWIEPH))
    {
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\", \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed\": %f, \"long_s\": \"%s\", \"iflagret\": %ld, \"error\": false }%s",
                         ast_num, snam, x[0], x[1], x[2], x[3], dms(x[0], round_flag | BIT_ZODIAC), iflagret, sChar);
      calculated_count++;
    }
    else
    {
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\", \"long\": 0.0, \"lat\": 0.0, \"distance\": 0.0, \"speed\": 0.0, \"long_s\": \"\", \"iflagret\": %ld, \"error\": true, \"error_msg\": \"%s\" }%s",
                         ast_num, snam, iflagret, serr, sChar);
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
 * @param year Year (1800-2400)
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

    if (iflagret >= 0 && (iflagret & SEFLG_SWIEPH))
    {
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\", \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed\": %f, \"long_s\": \"%s\", \"iflagret\": %ld, \"error\": false }%s",
                         ast_num, snam, x[0], x[1], x[2], x[3], dms(x[0], round_flag | BIT_ZODIAC), iflagret, sChar);
      calculated_count++;
    }
    else
    {
      length += snprintf(Buffer + length, buflen - length,
                         " { \"index\": %d, \"name\": \"%s\", \"long\": 0.0, \"lat\": 0.0, \"distance\": 0.0, \"speed\": 0.0, \"long_s\": \"\", \"iflagret\": %ld, \"error\": true, \"error_msg\": \"%s\" }%s",
                         ast_num, snam, iflagret, serr, sChar);
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
                     "\"date_range\": { \"start\": \"1800-01-01\", \"end\": \"2400-01-01\" }, ");
  length += snprintf(Buffer + length, buflen - length,
                     "\"files_loaded\": \"VFS\", ");
  length += snprintf(Buffer + length, buflen - length,
                     "\"compression\": \"LZ4\" }");
  
  return Buffer;
}

/**
 * @brief Calculate planetary positions only (without houses)
 * @param year Year (1800-2400)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @param hour Hour (0-23)
 * @param minute Minute (0-59)
 * @param second Second (0-59)
 * @return JSON string containing planetary positions
 */
EMSCRIPTEN_KEEPALIVE
const char *getPlanets(int year, int month, int day, int hour, int minute, int second)
{
  char snam[40], serr[AS_MAXCH];
  double jut = 0.0;
  double tjd_ut, x[6];
  long iflag, iflagret;
  int p;
  int round_flag = 0;
  char *Buffer = malloc(50000);
  int length = 0;
  char *sChar = malloc(3);

  swe_set_ephe_path("eph");
  iflag = SEFLG_SWIEPH | SEFLG_SPEED;

  jut = (double)hour + (double)minute / 60 + (double)second / 3600;
  tjd_ut = swe_julday(year, month, day, jut, SE_GREG_CAL);

  length += snprintf(Buffer + length, 50000 - length, "{ ");
  length += snprintf(Buffer + length, 50000 - length,
                     "\"initDate\": { \"year\": %d, \"month\": %d, \"day\": %d, \"hour\": %d, \"minute\": %d, \"second\": %d, \"jd_ut\": %f }, ", 
                     year, month, day, hour, minute, second, tjd_ut);

  length += snprintf(Buffer + length, 50000 - length, "\"planets\": [ ");

  for (p = SE_SUN; p < SE_NPLANETS; p++)
  {
    if (p == SE_EARTH) continue;
    
    strcpy(sChar, ", ");
    if (p == SE_NPLANETS - 1)
      strcpy(sChar, " ");

    iflagret = swe_calc_ut(tjd_ut, p, iflag, x, serr);

    if (iflagret > 0 && (iflagret & SEFLG_SWIEPH))
    {
      swe_get_planet_name(p, snam);
      length += snprintf(Buffer + length, 50000 - length,
                         " { \"index\": %d, \"name\": \"%s\", \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed\": %f, \"long_s\": \"%s\", \"iflagret\": %ld, \"error\": false }%s", 
                         p, snam, x[0], x[1], x[2], x[3], dms(x[0], round_flag | BIT_ZODIAC), iflagret, sChar);
    }
    else
    {
      swe_get_planet_name(p, snam);
      length += snprintf(Buffer + length, 50000 - length,
                         " { \"index\": %d, \"name\": \"%s\", \"long\": 0.0, \"lat\": 0.0, \"distance\": 0.0, \"speed\": 0.0, \"long_s\": \"\", \"iflagret\": %ld, \"error\": true, \"error_msg\": \"%s\" }%s", 
                         p, snam, iflagret, serr, sChar);
    }
  }

  length += snprintf(Buffer + length, 50000 - length, "] }");
  free(sChar);
  return Buffer;
}

/**
 * @brief Calculate house cusps and angles only (without planets)
 * @param year Year (1800-2400)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @param hour Hour (0-23)
 * @param minute Minute (0-59)
 * @param second Second (0-59)
 * @param lonG Longitude degrees
 * @param lonM Longitude minutes
 * @param lonS Longitude seconds
 * @param lonEW Longitude direction ("E" or "W")
 * @param latG Latitude degrees
 * @param latM Latitude minutes
 * @param latS Latitude seconds
 * @param latNS Latitude direction ("N" or "S")
 * @param iHouse House system character (P=Placidus, K=Koch, etc.)
 * @return JSON string containing house cusps and angles
 */
EMSCRIPTEN_KEEPALIVE
const char *getHouses(int year, int month, int day, int hour, int minute, int second, int lonG, int lonM, int lonS, char *lonEW, int latG, int latM, int latS, char *latNS, char *iHouse)
{
  double jut = 0.0;
  double tjd_ut, lon, lat;
  double cusp[12 + 1];
  double ascmc[10];
  long iflag;
  int i;
  int round_flag = 0;
  char *Buffer = malloc(10000);
  int length = 0;
  char *sChar = malloc(3);

  swe_set_ephe_path("eph");
  iflag = SEFLG_SWIEPH | SEFLG_SPEED;

  jut = (double)hour + (double)minute / 60 + (double)second / 3600;
  tjd_ut = swe_julday(year, month, day, jut, SE_GREG_CAL);

  lon = lonG + lonM / 60.0 + lonS / 3600.0;
  if (*lonEW == 'W') lon = -lon;
  lat = latG + latM / 60.0 + latS / 3600.0;
  if (*latNS == 'S') lat = -lat;

  swe_houses_ex(tjd_ut, iflag, lat, lon, (int)*iHouse, cusp, ascmc);

  length += snprintf(Buffer + length, 10000 - length, "{ ");
  length += snprintf(Buffer + length, 10000 - length,
                     "\"initDate\": { \"year\": %d, \"month\": %d, \"day\": %d, \"hour\": %d, \"minute\": %d, \"second\": %d, \"jd_ut\": %f }, ", 
                     year, month, day, hour, minute, second, tjd_ut);
  
  length += snprintf(Buffer + length, 10000 - length, "\"ascmc\": [ ");
  length += snprintf(Buffer + length, 10000 - length,
                     "{ \"name\": \"Asc\", \"long\": %f, \"long_s\": \"%s\" }, ", 
                     ascmc[0], dms(ascmc[0], round_flag | BIT_ZODIAC));
  length += snprintf(Buffer + length, 10000 - length,
                     "{ \"name\": \"MC\", \"long\": %f, \"long_s\": \"%s\" } ", 
                     ascmc[1], dms(ascmc[1], round_flag | BIT_ZODIAC));
  length += snprintf(Buffer + length, 10000 - length, "], ");

  length += snprintf(Buffer + length, 10000 - length, "\"houses\": [ ");
  for (i = 1; i <= 12; i++)
  {
    strcpy(sChar, ", ");
    if (i == 12) strcpy(sChar, " ");
    
    length += snprintf(Buffer + length, 10000 - length,
                       "{ \"name\": \"%d\", \"long\": %f, \"long_s\": \"%s\" }%s ", 
                       i, cusp[i], dms(cusp[i], round_flag | BIT_ZODIAC), sChar);
  }
  length += snprintf(Buffer + length, 10000 - length, "] }");

  free(sChar);
  return Buffer;
}

/**
 * @brief Convert decimal degrees to degrees/minutes/seconds format
 * @param degrees Decimal degrees
 * @param format Format flags (BIT_ZODIAC for zodiac signs, etc.)
 * @return Formatted string representation
 */
EMSCRIPTEN_KEEPALIVE
const char *degreesToDMS(double degrees, int format)
{
  char *Buffer = malloc(100);
  const char *result = dms(degrees, format);
  strcpy(Buffer, result);
  return Buffer;
}

/**
 * @brief Calculate Julian Day for a given date/time
 * @param year Year (1800-2400)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @param hour Hour (0-23)
 * @param minute Minute (0-59)
 * @param second Second (0-59)
 * @return Julian Day (as JSON string for consistency)
 */
EMSCRIPTEN_KEEPALIVE
const char *getJulianDay(int year, int month, int day, int hour, int minute, int second)
{
  double jut = (double)hour + (double)minute / 60 + (double)second / 3600;
  double tjd_ut = swe_julday(year, month, day, jut, SE_GREG_CAL);
  
  char *Buffer = malloc(500);
  snprintf(Buffer, 500, 
           "{ \"year\": %d, \"month\": %d, \"day\": %d, \"hour\": %d, \"minute\": %d, \"second\": %d, \"julian_day\": %f }", 
           year, month, day, hour, minute, second, tjd_ut);
  
  return Buffer;
}

/**
 * @brief Calculate position for a single planet
 * @param planet_id Planet number (0=Sun, 1=Moon, etc.)
 * @param year Year (1800-2400)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @param hour Hour (0-23)
 * @param minute Minute (0-59)
 * @param second Second (0-59)
 * @return JSON string containing single planet position
 */
EMSCRIPTEN_KEEPALIVE
const char *getPlanet(int planet_id, int year, int month, int day, int hour, int minute, int second)
{
  char snam[40], serr[AS_MAXCH];
  double jut = 0.0;
  double tjd_ut, x[6];
  long iflag, iflagret;
  int round_flag = 0;
  char *Buffer = malloc(1000);

  swe_set_ephe_path("eph");
  iflag = SEFLG_SWIEPH | SEFLG_SPEED;

  jut = (double)hour + (double)minute / 60 + (double)second / 3600;
  tjd_ut = swe_julday(year, month, day, jut, SE_GREG_CAL);

  iflagret = swe_calc_ut(tjd_ut, planet_id, iflag, x, serr);
  swe_get_planet_name(planet_id, snam);

  if (iflagret > 0 && (iflagret & SEFLG_SWIEPH))
  {
    snprintf(Buffer, 1000,
             "{ \"index\": %d, \"name\": \"%s\", \"long\": %f, \"lat\": %f, \"distance\": %f, \"speed\": %f, \"long_s\": \"%s\", \"jd_ut\": %f, \"iflagret\": %ld, \"error\": false }",
             planet_id, snam, x[0], x[1], x[2], x[3], dms(x[0], round_flag | BIT_ZODIAC), tjd_ut, iflagret);
  }
  else
  {
    snprintf(Buffer, 1000,
             "{ \"index\": %d, \"name\": \"%s\", \"long\": 0.0, \"lat\": 0.0, \"distance\": 0.0, \"speed\": 0.0, \"long_s\": \"\", \"jd_ut\": %f, \"iflagret\": %ld, \"error\": true, \"error_msg\": \"%s\" }",
             planet_id, snam, tjd_ut, iflagret, serr);
  }

  return Buffer;
}

/**
 * @brief Free memory allocated by other functions
 * @param ptr Pointer to memory to free
 */
EMSCRIPTEN_KEEPALIVE
void freeMemory(void *ptr)
{
  if (ptr) {
    free(ptr);
  }
}

#endif
