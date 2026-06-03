import logger from '../utils/logger.js';
import vehicleRepository from '../repositories/vehicle.repository.js';
import customerRepository from '../repositories/customer.repository.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, page, limit, customerId } = req.query;

    const result = await vehicleRepository.findAll(companyId, {
      customerId,
      search,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 10
    });

    return res.status(200).json(result);
  } catch (err) {
    logger.error('VehicleController :: findAll >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findByCustomer = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { customerId } = req.params;

    const customer = await customerRepository.findById(companyId, customerId);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const vehicles = await vehicleRepository.findByCustomer(companyId, customerId);
    return res.status(200).json(vehicles);
  } catch (err) {
    logger.error('VehicleController :: findByCustomer >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const vehicle = await vehicleRepository.findById(companyId, id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    return res.status(200).json(vehicle);
  } catch (err) {
    logger.error('VehicleController :: findById >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { customerId, plate, brand, model, year, color, fuel, chassis, renavam, mileage, notes, favorite } = req.body;

    if (!customerId || !plate) {
      return res.status(422).json({ message: 'Fields customerId and plate are required' });
    }

    const customer = await customerRepository.findById(companyId, customerId);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const existing = await vehicleRepository.findByPlate(companyId, String(plate).toUpperCase());
    if (existing) {
      return res.status(409).json({ message: 'A vehicle with this plate already exists' });
    }

    const vehicle = await vehicleRepository.create({
      companyId,
      customerId,
      plate,
      brand,
      model,
      year,
      color,
      fuel,
      chassis,
      renavam,
      mileage,
      notes,
      favorite: !!favorite
    });

    // Garante apenas um favorito por cliente.
    if (vehicle.favorite) {
      await vehicleRepository.unsetFavorites(companyId, customerId, vehicle._id);
    }

    return res.status(201).json(vehicle);
  } catch (err) {
    logger.error('VehicleController :: create >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const body = req.body;

    if (!body || Object.keys(body).length === 0) {
      return res.status(422).json({ message: 'Body is empty' });
    }

    if (body.plate) {
      const existing = await vehicleRepository.findByPlate(companyId, String(body.plate).toUpperCase());
      if (existing && String(existing._id) !== String(id)) {
        return res.status(409).json({ message: 'A vehicle with this plate already exists' });
      }
    }

    const vehicle = await vehicleRepository.update(companyId, id, body);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    // Marcou como favorito → remove a marca dos demais veículos do cliente.
    if (body.favorite === true) {
      await vehicleRepository.unsetFavorites(companyId, vehicle.customerId, vehicle._id);
    }

    return res.status(200).json(vehicle);
  } catch (err) {
    logger.error('VehicleController :: update >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const vehicle = await vehicleRepository.softDelete(companyId, id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    return res.status(200).json({ message: 'Vehicle deleted successfully' });
  } catch (err) {
    logger.error('VehicleController :: destroy >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
