
import User from '../models/user.model.js';
import logger from '../utils/logger.js';
import { diacriticSensitiveRegex } from '../utils/formatter.js';
import userRepository from '../repositories/user.repository.js'

export const findAll = async (req, res) => {
  try {
    const { search } = req.query;
    const page = (req?.page - 1) || 0;
    const rowsPerPage = req?.perPage || 10;
    
    const query = {}
    if (search) {
        query.name = {
            $regex: diacriticSensitiveRegex(search),
            $options: "i",
        }
    }
    const users = await userRepository.findAll({ query, page, rowsPerPage })

    return res.status(200).json(users);
  } catch (err) {
    logger.error('FindAll error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { name, email, password, status, role } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email and password required' });

    const user = await User.findOne({ email });
    if (user) return res.status(422).json({ message: 'Invalid Email!' });

    const userCreated = await userRepository.create(req.body);
    return res.status(200).json(userCreated);
  } catch (err) {
    logger.error('Update Create error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);  
    }
    const { name, email, password, status, role } = req.body;
    if (!email || !name) return res.status(400).json({ message: 'email and name is required' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'the User not founded!' });

    const updated = await userRepository.update(id, req.body)
    return res.json(updated);
  } catch (err) {
    logger.error('update User error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

  export const findById = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);
    }
    const user = await userRepository.findById(id);
    if (!user) return res.status(404).json({ message: 'User not founded!' });

    return res.json(user);
  } catch (err) {
    logger.error('findById User error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);
    }

    await userRepository.destroy(id);

    return res.status(201).json({ message: 'Deleted with successfully' });
  } catch (err) {
    logger.error('destroy User error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
