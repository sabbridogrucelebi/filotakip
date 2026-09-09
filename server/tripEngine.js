// FiloTakip PRO - Trip Detection Engine
// Automatically detects trips based on ignition and movement patterns

class TripEngine {
  constructor(pool) {
    this.pool = pool;
    this.activeTrips = new Map(); // imei -> { tripId, startTime, startLat, startLng, lastLat, lastLng, maxSpeed, distance, movingPoints }
  }

  async onLocationUpdate(imei, locationData, accOn) {
    try {
      const speed = locationData.speed;
      const lat = locationData.latitude;
      const lng = locationData.longitude;
      const activeTrip = this.activeTrips.get(imei);

      // Trip START: ignition on + speed > 5
      if (accOn && speed > 5 && !activeTrip) {
        const [result] = await this.pool.execute(
          'INSERT INTO trips (device_imei, start_time, start_lat, start_lng) VALUES (?, NOW(), ?, ?)',
          [imei, lat, lng]
        );
        this.activeTrips.set(imei, {
          tripId: result.insertId,
          startTime: Date.now(),
          startLat: lat,
          startLng: lng,
          lastLat: lat,
          lastLng: lng,
          maxSpeed: speed,
          distance: 0,
          movingPoints: 1,
          speedSum: speed
        });
        console.log(`🚗 Trip STARTED for ${imei} (Trip #${result.insertId})`);
        return;
      }

      // Trip IN PROGRESS: update distance, speed stats
      if (activeTrip) {
        // Calculate distance from last point
        const segmentDist = this.haversine(activeTrip.lastLat, activeTrip.lastLng, lat, lng);
        if (segmentDist < 100) { // filter jumps
          activeTrip.distance += segmentDist;
        }
        if (speed > activeTrip.maxSpeed) activeTrip.maxSpeed = speed;
        if (speed > 5) {
          activeTrip.movingPoints++;
          activeTrip.speedSum += speed;
        }
        activeTrip.lastLat = lat;
        activeTrip.lastLng = lng;

        // Trip END: ignition off OR speed = 0 for extended time
        if (!accOn || (speed < 3 && !accOn)) {
          await this.endTrip(imei, activeTrip, lat, lng);
        }
      }
    } catch (err) {
      console.error('TripEngine error:', err.message);
    }
  }

  async endTrip(imei, trip, endLat, endLng) {
    try {
      const durationMinutes = Math.round((Date.now() - trip.startTime) / 1000 / 60);
      const avgSpeed = trip.movingPoints > 0 ? (trip.speedSum / trip.movingPoints) : 0;

      // Only save trips longer than 1 minute and > 0.1 km
      if (durationMinutes < 1 || trip.distance < 0.1) {
        await this.pool.execute('DELETE FROM trips WHERE id = ?', [trip.tripId]);
        this.activeTrips.delete(imei);
        return;
      }

      // Get fuel consumption estimate
      const [device] = await this.pool.execute('SELECT fuel_consumption FROM devices WHERE imei = ?', [imei]);
      const fuelRate = device.length > 0 ? device[0].fuel_consumption || 8.0 : 8.0;
      const fuelUsed = (trip.distance * fuelRate) / 100;

      await this.pool.execute(
        `UPDATE trips SET end_time = NOW(), end_lat = ?, end_lng = ?, distance_km = ?, 
         max_speed = ?, avg_speed = ?, duration_minutes = ?, fuel_used = ?, is_completed = 1
         WHERE id = ?`,
        [endLat, endLng, trip.distance.toFixed(2), trip.maxSpeed, avgSpeed.toFixed(1),
         durationMinutes, fuelUsed.toFixed(2), trip.tripId]
      );

      console.log(`🏁 Trip ENDED for ${imei} (Trip #${trip.tripId}) - ${trip.distance.toFixed(1)}km, ${durationMinutes}min`);
      this.activeTrips.delete(imei);
    } catch (err) {
      console.error('Error ending trip:', err.message);
    }
  }

  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}

module.exports = TripEngine;
