const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Test functions to trigger WebSocket events
async function testTrackCreation() {
  try {
    console.log('🎵 Testing track creation...');
    
    const trackData = {
      sceneId: 1,
      songId: 1,
      startTimeSeconds: 10.5,
      endTimeSeconds: 45.2,
      notes: 'Test track for WebSocket'
    };

    const response = await axios.post(`${API_BASE}/tracks`, trackData);
    console.log('✅ Track created:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error creating track:', error.response?.data || error.message);
  }
}

async function testLicenseStatusUpdate(trackId) {
  try {
    console.log('🔄 Testing license status update...');
    
    const updateData = {
      status: 'IN_REVIEW',
      notes: 'Test license update for WebSocket'
    };

    const response = await axios.patch(`${API_BASE}/licenses/tracks/${trackId}/status`, updateData);
    console.log('✅ License status updated:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error updating license status:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting WebSocket API tests...');
  console.log('Make sure your WebSocket client is connected to see the events!');
  
  // Wait a bit for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test track creation (should trigger trackCreated and licenseStatusUpdate events)
  const track = await testTrackCreation();
  
  if (track && track.id) {
    // Wait a bit then update license status
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testLicenseStatusUpdate(track.id);
  }
  
  console.log('✅ Tests completed! Check your WebSocket client for events.');
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testTrackCreation, testLicenseStatusUpdate };
