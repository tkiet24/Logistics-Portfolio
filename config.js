window.PORTFOLIO_CONFIG = {
  scales: {
    // -----------------------------------------
    // HOME SECTION
    // -----------------------------------------
    globe: 1.0,           // Base scale multiplier for the globe
    delivery: 0.5,        // Scale of the delivery truck replacing the box ship

    // -----------------------------------------
    // ABOUT SECTION (Port Scene)
    // -----------------------------------------
    trainRig: 0.95,       // Base scale for the train locomotive and wagons
    railway: 1.1,         // Base scale for the railway tracks
    containersAbout: 1.0, // Scale multiplier for the containers on the train wagons

    // -----------------------------------------
    // SKILLS SECTION
    // -----------------------------------------
    containersSkills: 1.0,// Scale of the revolving skill containers

    // -----------------------------------------
    // WORK SECTION (City Scene)
    // -----------------------------------------
    sedanSports: 0.52,    // Scale of the car driving on the road
    buildings: {
      heroSkyscrapers: 2.2, // Footprint width for the tall hero milestones
      heroNormal: 1.8,      // Footprint width for the normal hero milestones
      midGround: 1.8,       // Base footprint width for the background row
      farSkyscrapers: 2.5,  // Footprint width for far background skyscrapers
      farNormal: 1.5,       // Base footprint width for far background buildings
      parasols: 0.8,        // Footprint width for street umbrellas
      awnings: 1.2          // Footprint width for building awnings
    }
  }
};
