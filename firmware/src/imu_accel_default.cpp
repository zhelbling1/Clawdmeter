#include "hal/imu_hal.h"

// Weak default: boards without an accelerometer reading get no shake or tilt
// in pet mode. A board's imu.cpp overrides it.
__attribute__((weak)) bool imu_hal_accel(float* x, float* y, float* z) {
    (void)x; (void)y; (void)z;
    return false;
}
