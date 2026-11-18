import { expect, it } from 'vitest';
import { probeWeights, reviewExperiment } from './weight-experiment.ts';

const sample = {
  "model": "linear-2d-v1",
  "train": [
    [
      -2,
      0
    ],
    [
      0,
      1
    ],
    [
      1,
      2
    ],
    [
      2,
      -1
    ],
    [
      -1,
      -2
    ],
    [
      3,
      1
    ]
  ],
  "holdout": [
    [
      1,
      -1
    ],
    [
      -3,
      2
    ],
    [
      2,
      2
    ],
    [
      0,
      -2
    ]
  ],
  "audit": [
    {
      "action": "evaluate",
      "rate": 0.1,
      "epochs": 20,
      "initial": [
        0,
        0,
        0
      ],
      "weights": [
        2.000361007327033,
        -2.99652780976591,
        0.9907537669732077
      ],
      "before": 51.75,
      "after": 0.00010719873933999614,
      "improved": true,
      "trainingRows": 6,
      "validationRows": 4
    },
    {
      "action": "accept",
      "weights": [
        2.000361007327033,
        -2.99652780976591,
        0.9907537669732077
      ]
    },
    {
      "action": "rollback",
      "weights": [
        0,
        0,
        0
      ]
    }
  ]
};
it('replays the Weight-Space export including approval and rollback', () => {
  expect(reviewExperiment(JSON.stringify(sample))).toMatchObject({ evaluated:1, accepted:1, rolledBack:1, activeMse:51.75 });
});
it('rejects a changed score and a rollback without history', () => {
  const changed = structuredClone(sample);
  changed.audit[0]!.after = 0;
  expect(() => reviewExperiment(JSON.stringify(changed))).toThrow();
  expect(() => reviewExperiment(JSON.stringify({...sample,audit:sample.audit.slice(-1)}))).toThrow();
});

it('checks the accepted weights on a separate 25-point grid', () => {
  expect(probeWeights([2,-3,1])).toMatchObject({count:25,rmse:0,maximum:0});
  const result=reviewExperiment(JSON.stringify(sample));
  expect(result.probe).toEqual(probeWeights([0,0,0]));
  expect(result.probe.maximum).toBe(23.5);
});
