#pragma once
#include <stdint.h>

// Optional accelerometer-driven orientation tracker. Returns 0..3 (quarter
// turns CW from default mounting). Boards without an IMU — or boards with
// rotation intentionally disabled, like AMOLED-1.8 fixed at 0° — return 0
// from imu_hal_rotation_quadrant() and no-op on init/tick.

void    imu_hal_init(void);
void    imu_hal_tick(void);
uint8_t imu_hal_rotation_quadrant(void);

// The latest acceleration in g in screen axes (+x right, +y down the UI as
// it is drawn now, z out of the glass), for pet mode's shake and tilt
// (pet.h). False when the board has no accelerometer reading: the weak
// default in imu_accel_default.cpp, which boards without one leave alone.
bool    imu_hal_accel(float* x, float* y, float* z);

// Sensor x/y to screen x/y for a rotation quadrant, as the QMI8658 boards
// pick it (quadrant 3 = +y dominant, 1 = -y, 0 = +x, 2 = -x): the axis
// gravity picked becomes screen y and the other one a quarter turn on.
static inline void imu_screen_axes(uint8_t quadrant, float ax, float ay, float* sx, float* sy) {
    switch (quadrant & 3) {
    case 3:  *sx = ax;  *sy = ay;  break;
    case 1:  *sx = -ax; *sy = -ay; break;
    case 0:  *sx = -ay; *sy = ax;  break;
    default: *sx = ay;  *sy = -ax; break;
    }
}
