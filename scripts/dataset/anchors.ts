/**
 * Hand-written "anchor" records: well-known titles so the demo feels familiar
 * (people instinctively type "matrix" or "star wars"). Titles and years are
 * public facts; the one-line descriptions are original. Ratings and popularity
 * are illustrative numbers for the demo, not real-world data.
 */
import type { SearchRecord } from '../../src/engine/types.ts'

type AnchorTuple = [title: string, year: number, genres: string[], rating: number, popularity: number, description: string]

const ANCHORS: AnchorTuple[] = [
  ['The Matrix', 1999, ['Sci-Fi', 'Action'], 8.7, 98400, 'A restless programmer learns that the world he knows is a simulation and that a war for humanity is being fought outside of it.'],
  ['The Matrix Reloaded', 2003, ['Sci-Fi', 'Action'], 7.2, 61200, 'Six months after waking up, the freed hackers race to stop a machine army drilling toward the last human city.'],
  ['The Matrix Revolutions', 2003, ['Sci-Fi', 'Action'], 6.7, 48900, 'The siege of Zion begins while one man travels to the machine capital to bargain for a truce.'],
  ['Inception', 2010, ['Sci-Fi', 'Thriller', 'Action'], 8.8, 97100, 'A thief who steals secrets from dreams is offered a clean record if he can plant an idea instead of taking one.'],
  ['Interstellar', 2014, ['Sci-Fi', 'Drama', 'Adventure'], 8.7, 94300, 'As crops fail across the planet, a former pilot leaves his children behind to search for a habitable world beyond a wormhole.'],
  ['Blade Runner', 1982, ['Sci-Fi', 'Thriller'], 8.1, 71800, 'A weary detective is pulled back to hunt four synthetic humans who have returned to a rain-soaked city to meet their maker.'],
  ['Blade Runner 2049', 2017, ['Sci-Fi', 'Drama', 'Mystery'], 8.0, 64500, 'A new generation replicant unearths a buried secret that could unravel what is left of society.'],
  ['Alien', 1979, ['Horror', 'Sci-Fi'], 8.5, 79900, 'The crew of a commercial freighter answers a distress signal and brings something back aboard that hunts them one by one.'],
  ['Aliens', 1986, ['Action', 'Sci-Fi', 'Horror'], 8.4, 72600, 'The lone survivor of the freighter returns to the moon where it all began, this time with a squad of marines.'],
  ['The Godfather', 1972, ['Crime', 'Drama'], 9.2, 96800, 'The reluctant youngest son of a New York crime family is drawn into the business he swore he would never join.'],
  ['The Godfather Part II', 1974, ['Crime', 'Drama'], 9.0, 81300, 'The family empire expands into Nevada and Cuba while flashbacks trace how a Sicilian orphan built it.'],
  ['Pulp Fiction', 1994, ['Crime', 'Drama'], 8.9, 92700, 'Two hitmen, a boxer, a gangster and his wife collide across a scrambled timeline of diners, briefcases and bad decisions.'],
  ['Fight Club', 1999, ['Drama', 'Thriller'], 8.8, 88600, 'An insomniac office worker and a charismatic soap salesman start an underground boxing ring that grows into something far darker.'],
  ['Amélie', 2001, ['Comedy', 'Romance'], 8.3, 66100, 'A shy Parisian waitress quietly rearranges the lives of the people around her while working up the nerve to fix her own.'],
  ['Spirited Away', 2001, ['Animation', 'Fantasy', 'Adventure'], 8.6, 85200, 'A ten-year-old wanders into a bathhouse for spirits and must work there to free her parents from a curse.'],
  ['Seven Samurai', 1954, ['Action', 'Drama', 'Adventure'], 8.6, 43800, 'A poor farming village hires seven wandering warriors to defend its harvest from a band of raiders.'],
  ['Metropolis', 1927, ['Sci-Fi', 'Drama'], 8.3, 21400, 'In a towering city of the future, the son of the ruler descends into the workers’ underworld and falls for a prophet of peace.'],
  ['Casablanca', 1942, ['Drama', 'Romance', 'War'], 8.5, 52300, 'A cynical nightclub owner in wartime Morocco must choose between the woman he lost and the cause he abandoned.'],
  ['Citizen Kane', 1941, ['Drama', 'Mystery'], 8.3, 38700, 'A reporter tries to decode the last word of a newspaper tycoon by interviewing everyone who knew him.'],
  ['12 Angry Men', 1957, ['Drama', 'Crime'], 9.0, 49100, 'A single juror refuses to vote guilty and slowly forces eleven others to re-examine the evidence.'],
  ['Jaws', 1975, ['Thriller', 'Adventure'], 8.1, 60400, 'A beach town’s police chief, a marine biologist and a shark hunter set out to kill the great white terrorising the summer season.'],
  ['Star Wars', 1977, ['Sci-Fi', 'Adventure', 'Fantasy'], 8.6, 95600, 'A farm boy, a smuggler and a princess join a rebellion against a galactic empire and its planet-destroying battle station.'],
  ['The Empire Strikes Back', 1980, ['Sci-Fi', 'Adventure', 'Fantasy'], 8.7, 83900, 'The rebels scatter after a crushing defeat while their young pilot trains with a hermit master in a swamp.'],
  ['Return of the Jedi', 1983, ['Sci-Fi', 'Adventure', 'Fantasy'], 8.3, 74200, 'The rebellion stakes everything on destroying a second battle station while a son tries to redeem his father.'],
  ['Back to the Future', 1985, ['Sci-Fi', 'Comedy', 'Adventure'], 8.5, 87400, 'A teenager is accidentally sent thirty years into the past in a modified sports car and must make sure his parents fall in love.'],
  ['Jurassic Park', 1993, ['Adventure', 'Sci-Fi', 'Thriller'], 8.2, 86100, 'A billionaire invites experts to preview his island theme park of cloned dinosaurs, right before the power fails.'],
  ['The Terminator', 1984, ['Sci-Fi', 'Action', 'Thriller'], 8.1, 69700, 'A machine assassin is sent back in time to kill the mother of a future resistance leader; a lone soldier follows to protect her.'],
  ['Terminator 2: Judgment Day', 1991, ['Sci-Fi', 'Action'], 8.6, 80800, 'A reprogrammed machine becomes the guardian of the boy it was once built to erase.'],
  ['Toy Story', 1995, ['Animation', 'Family', 'Comedy'], 8.3, 82600, 'A cowboy doll’s place as the favourite toy is threatened by a flashy new space ranger who does not know he is a toy.'],
  ['Finding Nemo', 2003, ['Animation', 'Family', 'Adventure'], 8.2, 78300, 'An overprotective clownfish crosses the ocean with a forgetful companion to find his captured son.'],
  ['The Lion King', 1994, ['Animation', 'Family', 'Drama'], 8.5, 84800, 'A young lion flees his kingdom after his father’s death and must return to claim his place from his scheming uncle.'],
  ['Parasite', 2019, ['Thriller', 'Drama', 'Comedy'], 8.5, 77900, 'A poor family schemes its way into the household of a wealthy one, until a secret in the basement changes everything.'],
  ['Oldboy', 2003, ['Thriller', 'Mystery', 'Action'], 8.4, 41600, 'A man imprisoned in a room for fifteen years without explanation is released and given five days to find out why.'],
  ['Mad Max: Fury Road', 2015, ['Action', 'Adventure', 'Sci-Fi'], 8.1, 76400, 'A drifter and a rebel commander flee a tyrant across the wasteland in a war rig full of his escaped wives.'],
  ['The Dark Knight', 2008, ['Action', 'Crime', 'Drama'], 9.0, 97900, 'A masked vigilante, a district attorney and a police lieutenant take on a criminal mastermind who wants to watch the city burn.'],
  ['Heat', 1995, ['Crime', 'Thriller', 'Action'], 8.3, 55700, 'A meticulous thief and the detective chasing him recognise how alike they are as a final heist approaches.'],
  ['Goodfellas', 1990, ['Crime', 'Drama'], 8.7, 79100, 'Three decades in the life of a mob associate, from running errands as a kid to testifying against his friends.'],
  ['Whiplash', 2014, ['Drama', 'Music'], 8.5, 68200, 'A young jazz drummer is pushed to the brink by an instructor who believes cruelty is the only path to greatness.'],
  ['La La Land', 2016, ['Romance', 'Music', 'Drama'], 8.0, 65300, 'An aspiring actress and a jazz pianist fall in love in Los Angeles while their ambitions pull them apart.'],
  ['Arrival', 2016, ['Sci-Fi', 'Drama', 'Mystery'], 7.9, 63800, 'A linguist is recruited to communicate with visitors whose circular language changes the way she experiences time.'],
  ['Ex Machina', 2014, ['Sci-Fi', 'Thriller', 'Drama'], 7.7, 51900, 'A programmer wins a week at his reclusive CEO’s estate to test whether a humanoid robot is truly conscious.'],
  ['Coco', 2017, ['Animation', 'Family', 'Music'], 8.4, 70600, 'A boy who dreams of music despite his family’s ban is transported to the land of the dead on the Day of the Dead.'],
  ['WALL·E', 2008, ['Animation', 'Sci-Fi', 'Family'], 8.4, 73500, 'The last trash-compacting robot on an abandoned Earth follows a sleek probe into space and stumbles into humanity’s future.'],
  ['Gravity', 2013, ['Sci-Fi', 'Thriller', 'Drama'], 7.7, 49800, 'Two astronauts are stranded in orbit after debris destroys their shuttle and must improvise a way home.'],
  ['Dune', 2021, ['Sci-Fi', 'Adventure', 'Drama'], 8.0, 81700, 'A noble family takes stewardship of a desert planet whose spice is the most valuable substance in the universe.'],
  ['Léon: The Professional', 1994, ['Crime', 'Action', 'Drama'], 8.5, 58400, 'A solitary hitman reluctantly takes in a twelve-year-old neighbour after her family is murdered by a corrupt agent.'],
  ['Crouching Tiger, Hidden Dragon', 2000, ['Action', 'Adventure', 'Fantasy'], 7.9, 44700, 'A stolen sword sets two legendary warriors and a rebellious young aristocrat on a collision course across Qing-era China.'],
  ['Ratatouille', 2007, ['Animation', 'Comedy', 'Family'], 8.1, 69900, 'A rat with an extraordinary palate secretly guides a hapless kitchen boy to culinary fame in Paris.'],
  ['The Grand Budapest Hotel', 2014, ['Comedy', 'Drama', 'Adventure'], 8.1, 57200, 'A legendary concierge and his lobby boy are framed for murder after inheriting a priceless painting.'],
  ['Moonlight', 2016, ['Drama'], 7.4, 39300, 'Three chapters in the life of a boy growing up in Miami, learning who he is and who he is allowed to love.'],
  ['No Country for Old Men', 2007, ['Crime', 'Thriller', 'Drama'], 8.2, 62100, 'A welder finds a satchel of drug money in the desert and is hunted by a killer who decides fate with a coin toss.'],
  ['Get Out', 2017, ['Horror', 'Thriller', 'Mystery'], 7.8, 59600, 'A weekend meeting his girlfriend’s parents turns from awkward to terrifying as the hospitality hides a sinister purpose.'],
  ['Everything Everywhere All at Once', 2022, ['Sci-Fi', 'Comedy', 'Adventure'], 7.8, 72300, 'An overwhelmed laundromat owner must connect with versions of herself across the multiverse to stop a threat to all of them.'],
  ['Oppenheimer', 2023, ['Drama', 'History'], 8.3, 89500, 'The physicist who led the effort to build the atomic bomb grapples with what he has unleashed and with the men who turn on him.'],
  ['Zodiac', 2007, ['Crime', 'Mystery', 'Thriller'], 7.7, 42800, 'A cartoonist becomes obsessed with unmasking a serial killer who taunts the San Francisco press with ciphers.'],
  ['Hidden Figures', 2016, ['Drama', 'History'], 7.8, 47600, 'Three brilliant mathematicians fight for recognition while computing the trajectories that put astronauts in orbit.'],
]

export function anchorRecords(): SearchRecord[] {
  return ANCHORS.map(([title, year, genres, rating, popularity, description], i) => ({
    id: `rec-${String(i + 1).padStart(5, '0')}`,
    title,
    description,
    genres,
    year,
    rating,
    popularity,
  }))
}

export const ANCHOR_COUNT = ANCHORS.length
