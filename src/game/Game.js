import React, {Component} from 'react';
import {Table} from './Table';
import {DiceTray} from './Dice';
import {Player} from './Player';

export class Game extends Component {
	constructor(props) {
		super(props);

		this.state = {
			players: createPlayers(this.props.playerNames),
			currentPlayer: 0,
			rollsLeft: 3,
			dice: [0, 0, 0, 0, 0],
			heldDice: [false, false, false, false, false],
			rollingDice: null,
			rollingDiceTumbleCounts: null,
		};
	}

	beginRoll() {
		if (this.state.rollsLeft === 0) {
			// No more rolls left; just return
			return;
		}

		const tumbleCounts = this.state.heldDice.map(held =>
			held ? 0 : getTumbleCount()
		);
		this.setState({
			...this.state,
			rollsLeft: this.state.rollsLeft - 1,
			rollingDice: this.state.dice,
			rollingDiceTumbleCounts: tumbleCounts,
		});

		this.timeTumble();
	}

	timeTumble() {
		window.setTimeout(() => {
			this.tumbleDice();
		}, 50);
	}

	tumbleDice() {
		if (this.state.rollingDiceTumbleCounts.every(c => c === 0)) {
			this.endRoll();
			return;
		}

		const rollingDice = this.state.rollingDice.map((die, i) =>
			this.state.rollingDiceTumbleCounts[i] === 0
				? die
				: getDieRoll()
		);
		const tumbleCounts = this.state.rollingDiceTumbleCounts
			.map(c => Math.max(0, c - 1));
		this.setState({
			...this.state,
			rollingDice: rollingDice,
			rollingDiceTumbleCounts: tumbleCounts,
		});

		this.timeTumble();
	}

	endRoll() {
		this.setState({
			...this.state,
			dice: this.state.rollingDice,
			rollingDice: null,
			rollingDiceTumbleCounts: null,
		});
	}

	clickDie(index) {
		if (this.state.dice[index] === 0) {

			return;
		}

		const heldDice = this.state.heldDice.slice();
		heldDice[index] = !heldDice[index];
		this.setState({
			...this.state,
			heldDice: heldDice,
		});
	}

	clickCategory(category) {
		if (this.state.dice[0] === 0) {

			return;
		}

		const player = this.state.players[this.state.currentPlayer];

		if (player.hasCategoryScore(category.id) || category.isDerived) {

			return;
		}

		const score = getCategoryScore(category.id, player, this.state.dice);

		const players = this.state.players.slice();
		players[this.state.currentPlayer] = player.setCategoryScore(
			category.id,
			score
		);

		this.setState({
			...this.state,
			players: players,
			rollsLeft: 3,
			dice: [0, 0, 0, 0, 0],
			heldDice: [false, false, false, false, false],
			currentPlayer: (this.state.currentPlayer + 1) % players.length,
		});
	}

	gameHasEnded() {
		if (this.state.currentPlayer !== 0) {
			return false;
		}

		const player = this.state.players[0];
		const categories = getScoringCategories();
		return categories.every(c => c.isDerived || player.hasCategoryScore(c.id));
	}

	render() {
		return (
			<div className='game-area'>
				<Table players={this.state.players}
					   categories={getScoringCategories()}
					   dice={this.state.rollingDice ? null : this.state.dice}
					   currentPlayer={this.state.currentPlayer}
					   onClickCategory={c => this.clickCategory(c)}/>
				<DiceTray dice={this.state.rollingDice || this.state.dice}
				          held={this.state.heldDice}
				          rollsLeft={this.state.rollsLeft}
				          rolling={this.state.rollingDice ? true : false}
				          onClickRoll={() => this.beginRoll()}
				          onClickDie={i => this.clickDie(i)}/>
			</div>
		);
	}

	componentDidUpdate(prevProps, prevState) {
		if (this.gameHasEnded()) {
			this.props.onGameEnd(this.state.players);
		}
	}
}

function createPlayers(names) {
	const randomNames = shuffle(names);
	return randomNames.map(name => new Player(name));
}

function shuffle(items) {
	items = items.slice();
	for (let i = items.length - 1; i > 0; i--) {
		const n = Math.floor((i + 1) * Math.random());

		const temp = items[i];
		items[i] = items[n];
		items[n] = temp;
	}

	return items;
}

function getTumbleCount() {

	return 5 + Math.floor(13 * Math.random());
}

function getDieRoll() {
	return 1 + Math.floor(6 * Math.random());
}
const BONUS_THRESHOLD = (1 + 2 + 3 + 4 + 5 + 6) * 4;
const BONUS_CATEGORIES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];

function scoringCategory(id, displayName, isDerived = false) {
	return Object.freeze({
		id: id,
		displayName: displayName,
		isDerived: isDerived,
	});
}

const Reduce = Object.freeze({
	chain(...reducers) {
		if (reducers.length === 0) {
			throw new Error('Reducer chain needs at least one reducer');
		}

		return (player, dice) => {
			let result = dice;

			for (let i = 0; i < reducers.length; i++) {
				if (result === null) {
					break;
				}
				result = reducers[i](player, result);
			}

			return result || 0;
		};
	},

	regex(regex) {
		if (regex.global) {
			return (player, dice) => {
				const diceString = dice.join('');
				return diceString.match(regex);
			};
		} else {
			return (player, dice) => {
				const diceString = dice.join('');
				const matches = regex.exec(diceString);
				if (matches) {
					return matches[0];
				} else {
					return null;
				}
			};
		}
	},

	pairs(player, dice) {
		const diceString = dice.join('');
		const matches = diceString.match(/11|22|33|44|55|66/g);
		return matches;
	},

	unique(player, items) {

		const result = items.reduce((acc, val) => {
			if (acc[acc.length - 1] !== val) {
				acc.push(val);
			}
			return acc;
		}, []);
		return result.length > 0 ? result : null;
	},

	sum(player, dice) {
		if (typeof dice === 'string') {

			dice = dice.split('');
		}
		return dice.reduce((a, b) => a + +b, 0);
	},

	fixed(score) {
		return (player, _) => score;
	},
});

const scoringCategories = Object.freeze([
	// Top half - singles
	scoringCategory('ones', 'Ones'),
	scoringCategory('twos', 'Twos'),
	scoringCategory('threes', 'Threes'),
	scoringCategory('fours', 'Fours'),
	scoringCategory('fives', 'Fives'),
	scoringCategory('sixes', 'Sixes'),
	// Bonus
	scoringCategory('bonus', 'Bonus', true),
	// Pairs
	scoringCategory('one-pair', 'One pair'),
	scoringCategory('two-pairs', 'Two pairs'),
	scoringCategory('three-pairs', 'Three pairs'),
	// x-of-a-kind
	scoringCategory('three-of-a-kind', 'Three of a kind'),
	scoringCategory('four-of-a-kind', 'Four of a kind'),
	scoringCategory('five-of-a-kind', 'Five of a kind'),
	// Straights
	scoringCategory('small-straight', 'Small straight'),
	scoringCategory('large-straight', 'Large straight'),
	scoringCategory('full-straight', 'Full straight'),
	scoringCategory('full-house', 'Full house (2+3)'),
	// Chance
	scoringCategory('chance', 'Chance'),
	// Yatzy
	scoringCategory('yatzy', 'Yatzy'),
]);

const scoreReducers = Object.freeze({
	// Singles
	'ones': Reduce.chain(Reduce.regex(/1+/), Reduce.sum),
	'twos': Reduce.chain(Reduce.regex(/2+/), Reduce.sum),
	'threes': Reduce.chain(Reduce.regex(/3+/), Reduce.sum),
	'fours': Reduce.chain(Reduce.regex(/4+/), Reduce.sum),
	'fives': Reduce.chain(Reduce.regex(/5+/), Reduce.sum),
	'sixes': Reduce.chain(Reduce.regex(/6+/), Reduce.sum),

	'bonus': (player, dice) => {
		const totalSinglesScore = BONUS_CATEGORIES
			.map(cat => player.getCategoryScore(cat) || 0)
			.reduce((a, b) => a + b, 0);
		return totalSinglesScore >= BONUS_THRESHOLD ? 100 : 0;
	},

	'one-pair': Reduce.chain(
		Reduce.pairs,
		(player, pairs) => pairs[pairs.length - 1],
		Reduce.sum
	),
	'two-pairs': Reduce.chain(
		Reduce.pairs,
		Reduce.unique,
		(player, pairs) => {
			if (pairs.length < 2) {

				return null;
			}
			const pair1 = pairs[pairs.length - 1];
			const pair2 = pairs[pairs.length - 2];
			return pair1 + pair2;
		},
		Reduce.sum
	),
	'three-pairs': Reduce.chain(
		Reduce.pairs,
		Reduce.unique,
		(player, pairs) => {
			if (pairs.length < 3) {

				return null;
			}
			const pair1 = pairs[pairs.length - 1];
			const pair2 = pairs[pairs.length - 2];
			const pair3 = pairs[pairs.length - 3];
			return pair1 + pair2 + pair3;
		},
		Reduce.sum
	),

	'three-of-a-kind': Reduce.chain(
		Reduce.regex(/111|222|333|444|555|666/g),
		(player, triplets) => triplets[triplets.length - 1],
		Reduce.sum
	),
	'four-of-a-kind': Reduce.chain(

		Reduce.regex(/1111|2222|3333|4444|5555|6666/),
		Reduce.sum
	),
	'five-of-a-kind': Reduce.chain(

		Reduce.regex(/1{5}|2{5}|3{5}|4{5}|5{5}|6{5}/),
		Reduce.sum
	),

	'small-straight': Reduce.chain(
		Reduce.regex(/1.?2.?3.?4.?5/),
		Reduce.fixed(15)
	),
	'large-straight': Reduce.chain(
		Reduce.regex(/2.?3.?4.?5.?6/),
		Reduce.fixed(20)
	),
	'full-straight': Reduce.chain(
		Reduce.regex(/123456/),
		Reduce.fixed(25)
	),

	'full-house': Reduce.chain(
		(player, dice) => {
			const regex = /([1-6])\1.?([1-6])\2\2|([1-6])\3\3.?([1-6])\4/;
			const matches = regex.exec(dice.join(''));
			if (matches) {

				const group1 = matches[1] || matches[4]; // AA or BB
				const group2 = matches[2] || matches[3]; // AAA or BBB
				if (group1 !== group2) {
					return group1 + group1 + group2 + group2 + group2;
				}
			}
			return null;
		},
		Reduce.sum
	),

	'chance': Reduce.sum,

	'yatzy': Reduce.chain(
		Reduce.regex(/1{6}|2{6}|3{6}|4{6}|5{6}|6{6}/),
		Reduce.fixed(100)
	),
});

export function getScoringCategories() {
	return scoringCategories;
}

export function getCategoryScore(category, player, dice) {
	if (dice) {
		dice = dice.slice().sort((a, b) => a - b);
	}

	const reducer = scoreReducers[category];
	if (!reducer) {
		throw new Error(`Invalid scoring category: ${category}`);
	}
	return reducer(player, dice);
}

export function getAllCategoryScores(player, dice) {
	return scoringCategories.map(cat => scoreReducers[cat.id](player, dice));
}
